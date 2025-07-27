# AI Ad Manager v4 🚀

## Modern AI-Powered Google Ads Management Platform

**AI Ad Manager v4** is a sophisticated, AI-driven platform for analyzing Google Analytics data and optimizing Google Ads campaigns. Built with cutting-edge technologies, it provides actionable insights and automated recommendations to maximize advertising ROI.

![Next.js](https://img.shields.io/badge/Next.js-15.4.4-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-3C3C3D?style=for-the-badge&logo=supabase)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css)

---

## ✨ Features

### 🎯 **Core Analytics**
- **Real-time GA4 Integration** - Live Google Analytics 4 data synchronization
- **Campaign Performance Tracking** - Comprehensive Google Ads metrics monitoring
- **Multi-Account Management** - Handle multiple GA properties from one dashboard

### 🤖 **AI-Powered Insights**
- **Intelligent Recommendations** - AI-generated optimization suggestions
- **Anomaly Detection** - Automatic identification of performance irregularities
- **Predictive Analytics** - Forecast campaign performance trends

### 🔍 **Landing Page Intelligence**
- **Automated Page Analysis** - Firecrawl-powered content and SEO scoring
- **Conversion Optimization** - Identify and fix conversion bottlenecks
- **Performance Scoring** - Speed, mobile, and user experience metrics

### 🛡️ **Enterprise-Ready**
- **Row-Level Security** - Multi-tenant data isolation
- **Google OAuth Integration** - Secure authentication with Google accounts
- **Real-time Updates** - WebSocket-based live data synchronization

---

## 🏗️ Technology Stack

### **Frontend**
- **[Next.js 15.4.4](https://nextjs.org/)** - React framework with App Router
- **[React 19](https://react.dev/)** - Latest React with concurrent features
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework

### **Backend & Database**
- **[Supabase](https://supabase.com/)** - PostgreSQL database with real-time features
- **[PostgreSQL 17.4](https://www.postgresql.org/)** - Advanced relational database
- **Row Level Security (RLS)** - Database-level security policies

### **Integrations**
- **Google Analytics 4 API** - Direct GA4 data access
- **Google OAuth 2.0** - Secure authentication
- **Firecrawl MCP** - Landing page analysis and crawling

### **Development Tools**
- **[Taskmaster](https://github.com/jdsteinbach/taskmaster)** - AI-powered project management
- **ESLint & Prettier** - Code quality and formatting
- **Husky** - Git hooks for pre-commit checks

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 22.17.0+**
- **npm 10.9.2+**
- **Google Cloud Console** access
- **Supabase account**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/cyx-darren/ai-ad-manager-v4.git
   cd ai-ad-manager-v4
   ```

2. **Install dependencies**
   ```bash
   cd ai-google-ads-manager
   npm install
   ```

3. **Environment setup**
   ```bash
   # Copy environment template
   cp env.example.txt .env.local
   
   # Add your Supabase credentials
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

---

## 📖 Documentation

- **[Setup Guide](ai-google-ads-manager/docs/SETUP_GUIDE.md)** - Comprehensive development setup
- **[Database Schema](ai-google-ads-manager/docs/DATABASE_SCHEMA.md)** - Complete database documentation
- **[Seed Data](ai-google-ads-manager/scripts/seed-data.sql)** - Sample data for development

---

## 🏢 Project Structure

```
ai-ad-manager-v4/
├── ai-google-ads-manager/          # Next.js frontend application
│   ├── app/                        # Next.js App Router pages
│   ├── components/                 # React components
│   ├── lib/                        # Utility libraries (Supabase, Auth)
│   ├── contexts/                   # React contexts
│   ├── docs/                       # Project documentation
│   └── scripts/                    # Database scripts
├── .taskmaster/                    # Project management
│   ├── tasks/                      # Task definitions
│   └── docs/                       # PRD and specifications
└── .cursor/                        # Development configuration
```

---

## 🎨 UI Preview

The application features a **modern SaaS design** with:
- 🎨 **Vibrant color palette** with high contrast
- 📱 **Responsive design** for all devices
- ⚡ **Interactive components** with smooth animations
- 📊 **Dashboard-style metrics** cards
- 🔄 **Real-time updates** via WebSocket

---

## 🗄️ Database Schema

### Core Entities
- **`users`** - User profiles with Google OAuth tokens
- **`accounts`** - Google Analytics properties
- **`performance_metrics`** - GA4 data storage
- **`recommendations`** - AI-generated suggestions
- **`landing_page_analysis`** - Firecrawl analysis results

### Security Features
- **Row Level Security (RLS)** policies for data isolation
- **Multi-tenant architecture** with user-based access control
- **Automatic timestamps** and audit trails

---

## 🚀 Deployment

### Frontend (Vercel)
```bash
# Configure environment variables in Vercel
# Deploy with Git integration
vercel --prod
```

### Backend (Supabase Cloud)
- Production database already configured
- Environment variables set in `.env.local`
- Row Level Security policies active

---

## 🛣️ Roadmap

### ✅ **Completed (Tasks 1-2)**
- [x] Next.js 15 project setup with TypeScript
- [x] Supabase cloud integration with full schema
- [x] Authentication system with Google OAuth
- [x] Modern SaaS UI design system

### 🚧 **In Progress**
- [ ] Google Analytics 4 API integration
- [ ] AI recommendations engine
- [ ] Landing page analysis with Firecrawl

### 📋 **Planned Features**
- [ ] Performance dashboard with real-time metrics
- [ ] Campaign management interface
- [ ] Anomaly detection system
- [ ] Advanced reporting and exports
- [ ] Multi-tenant admin panel

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **[Live Demo](http://localhost:3000)** (Development)
- **[Supabase Project](https://supabase.com/dashboard/project/fjfwnjrmafoieiciuomm)**
- **[Documentation](ai-google-ads-manager/docs/)**

---

## 🙏 Acknowledgments

- **[Supabase](https://supabase.com/)** for the excellent backend infrastructure
- **[Next.js](https://nextjs.org/)** for the powerful React framework
- **[Taskmaster](https://github.com/jdsteinbach/taskmaster)** for AI-powered project management
- **Google Analytics 4** for comprehensive analytics data

---

<div align="center">

**Built with ❤️ using cutting-edge technologies**

[⭐ Star this repo](https://github.com/cyx-darren/ai-ad-manager-v4) | [🐛 Report issues](https://github.com/cyx-darren/ai-ad-manager-v4/issues) | [💬 Discussions](https://github.com/cyx-darren/ai-ad-manager-v4/discussions)

</div> 