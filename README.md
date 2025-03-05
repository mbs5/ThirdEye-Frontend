# ThirdEye Frontend

A modern React application that serves as an AI-powered photo storyteller. It allows users to search through their photo collection using natural language queries and voice commands.

## Features

- Voice recording and transcription using OpenAI Whisper
- Natural language photo search
- Beautiful image carousel with metadata display
- Text-to-speech response using OpenAI TTS
- Modern UI with dark theme and glowing effects
- Responsive design
- Error handling and fallbacks

## Tech Stack

- React 18
- Vite
- TypeScript
- Chakra UI
- OpenAI API (Whisper & TTS)

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/mbs5/ThirdEye-Frontend.git
cd ThirdEye-Frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your OpenAI API key:
```env
VITE_OPENAI_API_KEY=your_api_key_here
```

4. Start the development server:
```bash
npm run dev
```

## Environment Setup

Make sure you have the following environment variables set:
- `VITE_OPENAI_API_KEY`: Your OpenAI API key for transcription and TTS

## Usage

1. Click the "Start Recording" button
2. Ask a question about your photos
3. Click "Stop Recording" when done
4. Wait for the response and browse through relevant photos

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
