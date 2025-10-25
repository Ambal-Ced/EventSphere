# EventTria - Event Management Platform

A comprehensive event management platform built with Next.js 14, Supabase, and TypeScript.

## 🚀 Features

- **Event Creation & Management**: Create, edit, and manage events with detailed information
- **Real-time Collaboration**: Invite collaborators and manage team roles
- **Analytics Dashboard**: Comprehensive analytics with AI-powered insights
- **Attendance Tracking**: QR code-based check-in system
- **Feedback Collection**: Collect and analyze event feedback
- **AI Chat Integration**: AI-powered assistance for event management
- **User Profiles**: Complete user profile management
- **Notifications**: Real-time notification system

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Real-time)
- **UI Components**: Radix UI, Lucide React
- **Charts**: Recharts
- **AI**: Cohere AI integration
- **Deployment**: Vercel (recommended) or any Node.js hosting

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Cohere AI API key (optional, for AI features)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd eventtria
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   COHERE_API_KEY=your_cohere_api_key
   ```

4. **Database Setup**
   - Import the SQL schema from `supabase-schema.sql` (if available)
   - Set up Row Level Security (RLS) policies
   - Configure storage buckets for images and files

5. **Run the development server**
   ```bash
   npm run dev
   ```

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### Hostinger KVM/VPS
1. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2 for process management
   sudo npm install -g pm2
   
   # Install Nginx (optional, for reverse proxy)
   sudo apt install nginx -y
   ```

2. **Deploy Application**
   ```bash
   # Clone your repository
   git clone <your-repo-url>
   cd eventtria
   
   # Install dependencies
   npm install
   
   # Build the application
   npm run build
   
   # Start with PM2
   pm2 start npm --name "eventtria" -- start
   pm2 save
   pm2 startup
   ```

3. **Nginx Configuration** (optional)
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `COHERE_API_KEY` | Cohere AI API key | No |
| `NEXT_PUBLIC_APP_URL` | Your app URL (for production) | Yes |

## 📁 Project Structure

```
src/
├── app/                    # Next.js 14 app router
│   ├── analytics/          # Analytics dashboard
│   ├── auth/              # Authentication pages
│   ├── event/             # Event management
│   ├── events/            # Events listing
│   └── ...
├── components/            # Reusable components
├── lib/                   # Utility functions
├── types/                 # TypeScript type definitions
└── ...
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run linting
npm run lint

# Type checking
npm run type-check
```

## 📝 API Endpoints

- `/api/ai-chat` - AI chat functionality
- `/checkin/[token]` - QR code check-in
- `/feedback/[token]` - Feedback collection

## 🔧 Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support, email support@eventtria.com or create an issue in the repository.

---

**Built with ❤️ using Next.js and Supabase**