import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { ChakraProvider, Box, Button, Container, Heading, Text, VStack, useToast, Progress, Icon, useColorModeValue, HStack, IconButton, Image } from '@chakra-ui/react'
import { FaMicrophone, FaStop, FaArrowLeft, FaArrowRight } from 'react-icons/fa'
import OpenAI from 'openai'
import '../src/App.css'
import { Transcriptions } from 'openai/resources/audio/transcriptions.mjs'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, API calls should go through your backend
})

// Update interfaces
interface ImageMetadata {
  id: number;
  shot_at_when: string;
  shot_at_where: string;
  people_involved: string[];
  image_description: string;
  image_path: string;
}

interface APIResponse {
  query_keywords: {
    location: string | null;
    from_date: string;
    to_date: string;
    people_names: string[];
  };
  image_metadata: ImageMetadata[];
  story_description: string;
}

function AppContent() {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [images, setImages] = useState<ImageMetadata[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageLoadError, setImageLoadError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const toast = useToast()

  // Theme colors
  const bgColor = useColorModeValue('gray.900', 'gray.900')
  const responseBg = useColorModeValue('purple.900', 'purple.900')
  const borderColor = useColorModeValue('purple.500', 'purple.500')
  const textColor = useColorModeValue('white', 'white')
  const glowColor = isListening ? 'red.500' : 'purple.500'

  // Remove duplicate images by path and filter out invalid ones
  const uniqueImages = useMemo(() => {
    const seen = new Set();
    return images.filter(img => {
      // Skip duplicates
      if (seen.has(img.image_path)) return false;
      seen.add(img.image_path);
      return true;
    });
  }, [images]);

  // Normalize image path to match file system
  const getImagePath = (imagePath: string) => {
    // Log the incoming path for debugging
    console.log('Original image path:', imagePath);
    
    // If the path already includes /images/, use it as is
    if (imagePath.startsWith('/images/')) {
      return imagePath;
    }
    
    // If it's just a filename, add the /images/ prefix
    return `/images/${imagePath}`;
  };

  const handleImageError = useCallback((path: string) => {
    const fullPath = getImagePath(path);
    console.error(`Failed to load image: ${fullPath}`);
    setImageLoadError(`Failed to load image: ${fullPath}`);
    toast({
      title: 'Image Load Error',
      description: `Could not load image at: ${fullPath}. Check if the image exists and the path is correct.`,
      status: 'warning',
      duration: 5000,
      isClosable: true,
    });
  }, [toast]);

  // Preload images and verify existence
  useEffect(() => {
    if (uniqueImages.length > 0) {
      uniqueImages.forEach(img => {
        const fullPath = getImagePath(img.image_path);
        console.log('Preloading image:', fullPath);
        const preloadImage = document.createElement('img');
        preloadImage.src = fullPath;
        preloadImage.onerror = () => {
          console.error(`Failed to preload image: ${fullPath}`);
        };
      });
    }
  }, [uniqueImages]);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const startListening = useCallback(async () => {
    try {
      // Reset state
      chunksRef.current = []
      setTranscript('')
      setResponse('')
      setIsProcessing(false)

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        } 
      })

      // Use mp3 if supported, fallback to webm
      const mimeType = MediaRecorder.isTypeSupported('audio/mp3') 
        ? 'audio/mp3' 
        : 'audio/webm;codecs=opus'

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      })

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorderRef.current.start(100) // Smaller chunks
      setIsListening(true)

      // Add error handler
      mediaRecorderRef.current.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        stopListening()
        toast({
          title: 'Recording Error',
          description: 'There was an error while recording. Please try again.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        })
      }
    } catch (error) {
      console.error('Error starting recording:', error)
      toast({
        title: 'Error',
        description: 'Failed to start recording. Please check your microphone permissions.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }, [])

  const stopListening = useCallback(async () => {
    if (!mediaRecorderRef.current || !isListening) return

    try {
      setIsListening(false)
      setIsProcessing(true)

      // Create a promise that resolves when the recorder stops
      const audioBlob = await new Promise<Blob>((resolve, reject) => {
        if (!mediaRecorderRef.current) {
          reject(new Error('MediaRecorder not initialized'))
          return
        }

        const handleStop = () => {
          try {
            const blob = new Blob(chunksRef.current, { 
              type: mediaRecorderRef.current?.mimeType || 'audio/webm;codecs=opus'
            })
            if (blob.size === 0) {
              reject(new Error('No audio data recorded'))
              return
            }
            resolve(blob)
          } catch (e) {
            reject(e)
          }
        }

        mediaRecorderRef.current.onstop = handleStop
        mediaRecorderRef.current.stop()

        // Cleanup tracks
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      })

      // Log blob info for debugging
      console.log('Audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type
      })

      // Create file from blob
      const audioFile = new File([audioBlob], 'audio.webm', { 
        type: audioBlob.type,
        lastModified: Date.now()
      })

      // Transcribe with Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
        
      })

      if (!transcription.text) {
        throw new Error('No transcription received')
      }

      setTranscript(transcription.text)
      
      // Automatically submit after transcription
      try {
        const response = await fetch('/api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            query: transcription.text
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.story_description) {
          throw new Error('No story description found in response');
        }

        if (!Array.isArray(data.image_metadata)) {
          throw new Error('Invalid image metadata format in response');
        }

        setResponse(data.story_description);
        setImages(data.image_metadata);
        setCurrentImageIndex(0);
        setImageLoadError(null);
        speakResponse(data.story_description);

      } catch (error) {
        console.error('API error:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to process your query',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Recording/Transcription error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error 
          ? error.message 
          : 'Failed to process audio. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setIsProcessing(false)
      // Ensure tracks are stopped
      if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [isListening])

  const speakResponse = useCallback(async (text: string) => {
    try {
      const response = await openai.audio.speech.create({
        model: "tts-1",
        voice: "ash",
        input: text
      });

      // Convert the response to a blob URL
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create and play audio element
      const audio = new Audio(audioUrl);
      await audio.play();
      
      // Cleanup URL after playback
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (error) {
      console.error('TTS error:', error);
      toast({
        title: 'Speech Error',
        description: 'Failed to generate speech. Playing in fallback voice.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      
      // Fallback to browser speech synthesis
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [toast]);

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch" position="relative">
        <Box 
          position="absolute" 
          top="-100px" 
          left="50%" 
          transform="translateX(-50%)"
          width="200%"
          height="200%"
          bgGradient="radial(circle, purple.500 0%, transparent 70%)"
          opacity="0.1"
          pointerEvents="none"
        />
        
        <Box textAlign="center" mb={8} position="relative">
          <Heading 
            size="2xl" 
            bgGradient="linear(to-r, purple.400, pink.500)" 
            bgClip="text"
            fontWeight="extrabold"
            letterSpacing="tight"
            textShadow="0 0 20px rgba(159, 122, 234, 0.3)"
          >
            ThirdEye
          </Heading>
          <Text 
            mt={2} 
            color="whiteAlpha.700"
            fontSize="lg"
            fontWeight="medium"
          >
            Your AI-powered photo storyteller
          </Text>
        </Box>
        
        <HStack spacing={8} align="flex-start">
          <VStack flex="1" spacing={8}>
            <Box 
              p={8} 
              borderRadius="3xl" 
              bg={bgColor}
              position="relative"
              borderWidth="1px"
              borderColor={borderColor}
              boxShadow={`0 0 30px -5px ${isListening ? 'rgba(229, 62, 62, 0.3)' : 'rgba(159, 122, 234, 0.3)'}`}
              transition="all 0.3s ease"
              _hover={{
                transform: 'translateY(-2px)',
                boxShadow: `0 0 40px -5px ${isListening ? 'rgba(229, 62, 62, 0.4)' : 'rgba(159, 122, 234, 0.4)'}`
              }}
            >
              {isProcessing && (
                <Progress 
                  size="xs" 
                  isIndeterminate 
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  borderTopRadius="3xl"
                  bgGradient="linear(to-r, purple.500, pink.500)"
                  sx={{
                    '& > div': {
                      background: 'transparent !important'
                    }
                  }}
                />
              )}

              <Box mb={6}>
                <Text 
                  fontWeight="bold" 
                  mb={2} 
                  color="whiteAlpha.800"
                  fontSize="md"
                  letterSpacing="wide"
                  textTransform="uppercase"
                >
                  {isProcessing ? 'Processing...' : 'Your Question:'}
                </Text>
                <Box 
                  p={6} 
                  borderRadius="2xl" 
                  bg="blackAlpha.400"
                  borderWidth="1px"
                  borderColor={glowColor}
                  minH="120px"
                  transition="all 0.3s ease"
                  position="relative"
                  overflow="hidden"
                >
                  <Box
                    position="absolute"
                    top="0"
                    left="0"
                    right="0"
                    bottom="0"
                    bg={`${glowColor}10`}
                    filter="blur(20px)"
                    transform="translate(-50%, -50%)"
                    opacity={isListening ? 1 : 0}
                    transition="opacity 0.3s ease"
                  />
                  <Text 
                    fontSize="lg"
                    color={transcript ? textColor : 'whiteAlpha.500'}
                    position="relative"
                    zIndex={1}
                  >
                    {transcript || 'Speak to search through your photos...'}
                  </Text>
                </Box>
              </Box>
              
              <Button
                size="lg"
                width="full"
                colorScheme={isListening ? 'red' : 'purple'}
                onClick={isListening ? stopListening : startListening}
                leftIcon={<Icon as={isListening ? FaStop : FaMicrophone} />}
                isDisabled={isProcessing}
                _hover={{ 
                  transform: 'translateY(-2px)',
                  boxShadow: `0 0 20px -5px ${isListening ? 'rgba(229, 62, 62, 0.4)' : 'rgba(159, 122, 234, 0.4)'}` 
                }}
                transition="all 0.3s ease"
                height="60px"
                fontSize="lg"
                fontWeight="bold"
                borderRadius="xl"
                bgGradient={isListening ? 
                  "linear(to-r, red.500, pink.500)" : 
                  "linear(to-r, purple.500, pink.500)"
                }
                _active={{
                  bgGradient: isListening ? 
                    "linear(to-r, red.600, pink.600)" : 
                    "linear(to-r, purple.600, pink.600)"
                }}
              >
                {isListening ? 'Stop Recording' : 'Start Recording'}
              </Button>
            </Box>

            {response && (
              <Box 
                p={8} 
                borderRadius="3xl" 
                bg={responseBg}
                borderWidth="1px"
                borderColor="purple.500"
                boxShadow="0 0 30px -5px rgba(159, 122, 234, 0.3)"
                position="relative"
                overflow="hidden"
                transition="all 0.3s ease"
                _hover={{
                  transform: 'translateY(-2px)',
                  boxShadow: '0 0 40px -5px rgba(159, 122, 234, 0.4)'
                }}
              >
                <Box
                  position="absolute"
                  top="0"
                  left="0"
                  right="0"
                  bottom="0"
                  bgGradient="linear(to-br, purple.900, black)"
                  opacity="0.9"
                />
                <Text 
                  fontSize="lg" 
                  color="white" 
                  position="relative" 
                  zIndex={1}
                  lineHeight="tall"
                >
                  {response}
                </Text>
              </Box>
            )}
          </VStack>

          {uniqueImages.length > 0 && (
            <Box
              flex="1"
              p={8}
              borderRadius="3xl"
              bg={bgColor}
              position="relative"
              borderWidth="1px"
              borderColor={borderColor}
              boxShadow="0 0 30px -5px rgba(159, 122, 234, 0.3)"
              transition="all 0.3s ease"
              _hover={{
                transform: 'translateY(-2px)',
                boxShadow: '0 0 40px -5px rgba(159, 122, 234, 0.4)'
              }}
            >
              <VStack spacing={4}>
                <Text
                  fontWeight="bold"
                  color="whiteAlpha.800"
                  fontSize="md"
                  letterSpacing="wide"
                  textTransform="uppercase"
                >
                  Relevant Images ({currentImageIndex + 1}/{uniqueImages.length})
                </Text>
                
                <Box
                  position="relative"
                  width="100%"
                  paddingTop="75%" // 4:3 aspect ratio
                  overflow="hidden"
                  borderRadius="2xl"
                  bg="blackAlpha.400"
                >
                  <Image
                    src={getImagePath(uniqueImages[currentImageIndex].image_path)}
                    alt={uniqueImages[currentImageIndex].image_description || 'Image'}
                    position="absolute"
                    top="0"
                    left="0"
                    width="100%"
                    height="100%"
                    objectFit="cover"
                    transition="transform 0.3s ease"
                    loading="eager"
                    _hover={{ transform: 'scale(1.05)' }}
                    onError={() => handleImageError(uniqueImages[currentImageIndex].image_path)}
                    fallback={
                      <Box
                        position="absolute"
                        top="0"
                        left="0"
                        right="0"
                        bottom="0"
                        bg="blackAlpha.400"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        flexDirection="column"
                        p={4}
                        textAlign="center"
                      >
                        <Text color="whiteAlpha.800" fontSize="lg" mb={2}>
                          Image not found
                        </Text>
                        <Text color="whiteAlpha.600" fontSize="sm">
                          Attempted path: {getImagePath(uniqueImages[currentImageIndex].image_path)}
                        </Text>
                        {imageLoadError && (
                          <Text color="red.300" fontSize="xs" mt={2}>
                            {imageLoadError}
                          </Text>
                        )}
                      </Box>
                    }
                  />
                </Box>

                <HStack spacing={4}>
                  <IconButton
                    aria-label="Previous image"
                    icon={<Icon as={FaArrowLeft} />}
                    onClick={() => {
                      setCurrentImageIndex((prev) => 
                        (prev - 1 + uniqueImages.length) % uniqueImages.length
                      );
                    }}
                    isDisabled={uniqueImages.length <= 1}
                    colorScheme="purple"
                    variant="ghost"
                    size="lg"
                    _hover={{
                      transform: 'translateX(-2px)',
                      boxShadow: '0 0 20px -5px rgba(159, 122, 234, 0.4)'
                    }}
                  />
                  <IconButton
                    aria-label="Next image"
                    icon={<Icon as={FaArrowRight} />}
                    onClick={() => {
                      setCurrentImageIndex((prev) => 
                        (prev + 1) % uniqueImages.length
                      );
                    }}
                    isDisabled={uniqueImages.length <= 1}
                    colorScheme="purple"
                    variant="ghost"
                    size="lg"
                    _hover={{
                      transform: 'translateX(2px)',
                      boxShadow: '0 0 20px -5px rgba(159, 122, 234, 0.4)'
                    }}
                  />
                </HStack>

                <Box>
                  <Text
                    fontSize="sm"
                    color="whiteAlpha.800"
                    fontWeight="medium"
                  >
                    {uniqueImages[currentImageIndex].shot_at_where}
                  </Text>
                  <Text
                    fontSize="xs"
                    color="whiteAlpha.600"
                  >
                    {new Date(uniqueImages[currentImageIndex].shot_at_when).toLocaleDateString()}
                  </Text>
                  <Text
                    fontSize="xs"
                    color="whiteAlpha.400"
                    mt={1}
                  >
                    Image: {uniqueImages[currentImageIndex].image_path}
                  </Text>
                </Box>
              </VStack>
            </Box>
          )}
        </HStack>
      </VStack>
    </Container>
  )
}

function App() {
  return (
    <ChakraProvider>
      <AppContent />
    </ChakraProvider>
  )
}

export default App
