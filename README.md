# Atlas Career Coach

Atlas Career Coach is an interactive career guidance application that helps users discover potential careers in technology based on their interests, skills, and preferences. The application uses AI-powered conversations to provide personalized career recommendations.

## Project Structure

The project is organized as a monorepo with two main components:

```
atlas-monorepo/
├── client/           # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Admin.jsx    # Admin panel for managing instructions
│   │   │   └── Chat.jsx     # Main chat interface component
│   │   ├── App.js          # Main application component
│   │   └── config.js       # Configuration settings
│   └── public/
└── server/           # Express.js backend application
    ├── index.js      # Main server file
    └── instructions.js # Chat instructions configuration
```

## Features

- Interactive AI-powered chat interface
- Multiple choice and ranking questions
- Dynamic conversation flow based on user responses
- Admin panel for customizing chat instructions
- Secure authentication for admin access
- Responsive design for various screen sizes

## Technology Stack

- Frontend:
  - React
  - Axios for API calls
  - CSS-in-JS styling
  
- Backend:
  - Express.js
  - OpenAI API integration
  - Environment-based configuration
  - Session management

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/atlas-monorepo.git
cd atlas-monorepo
```

2. Install dependencies for both client and server:
```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

3. Create a `.env` file in the server directory with your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

### Running the Application

1. Start the server (from the server directory):
```bash
npm start
```

2. Start the client (from the client directory):
```bash
npm start
```

The application will be available at http://localhost:3000, with the server running on port 5001.

## Development

### Environment Configuration

The application supports different environments through the `config.js` file:
- Development: API calls to `localhost:5001`
- Production: API calls to the deployed server URL

### Admin Access

The admin panel is available at `/admin` and requires authentication. Use the provided admin credentials to access the panel.

## Deployment

The application is configured for deployment on Heroku. The production build process:

1. Builds the React client application
2. Serves the static files through the Express.js server
3. Uses environment variables for configuration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
