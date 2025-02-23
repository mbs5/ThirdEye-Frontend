import { useState } from 'react'
import { Box, Button, Text, VStack } from '@chakra-ui/react'

interface HelloResponse {
  message: string;
}

export function TestApi() {
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const testFetch = async () => {
    try {
      setIsLoading(true)
      setError('')
      
      // First try with no-cors mode
      const response = await fetch('https://4b24-2607-fb90-ada4-c4c7-5554-1f09-ea62-6bd5.ngrok-free.app/album_query', {
        method: 'GET',
        mode: 'no-cors',
        headers: {
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'Origin': window.location.origin,
        }
      })
      
      console.log('Response type:', response.type)
      console.log('Response status:', response.status)
      
      // With no-cors, we get an opaque response
      if (response.type === 'opaque') {
        // Try alternative approach using proxy
        const proxyResponse = await fetch('/api', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        })
        
        console.log('Proxy response status:', proxyResponse.status)
        const data = await proxyResponse.json()
        console.log('Proxy data:', data)
        setMessage(data.message)
        return
      }

      const data = await response.json()
      console.log('Direct data:', data)
      setMessage(data.message)
      
    } catch (error) {
      console.error('Fetch error:', error)
      setError(error instanceof Error ? error.message : 'Unknown error occurred')
      
      // Try the proxy as a fallback
      try {
        const proxyResponse = await fetch('/api', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        })
        
        const data = await proxyResponse.json()
        console.log('Fallback proxy data:', data)
        setMessage(data.message)
        setError('') // Clear error if proxy succeeds
      } catch (proxyError) {
        console.error('Proxy error:', proxyError)
        setError('Both direct and proxy requests failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <VStack spacing={4} p={4}>
      <Button 
        onClick={testFetch} 
        isLoading={isLoading}
        colorScheme="blue"
      >
        Test API
      </Button>
      {message && (
        <Box p={4} borderWidth="1px" borderRadius="md">
          <Text>{message}</Text>
        </Box>
      )}
      {error && (
        <Box p={4} borderWidth="1px" borderRadius="md" bg="red.50">
          <Text color="red.500">{error}</Text>
        </Box>
      )}
    </VStack>
  )
}
