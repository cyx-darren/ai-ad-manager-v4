'use client'

import ThemeTest from '../components/ThemeTest';
import OAuthTestSection from '../components/auth/OAuthTestSection';

export default function Home() {
  return (
    <div className='space-y-8'>
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          AI Ad Manager v4
        </h1>
        <p className="text-gray-600 mb-6">
          Welcome to the AI-powered advertising management platform. 
          This application helps optimize your Google Ads campaigns using advanced analytics and AI recommendations.
        </p>
        
        {/* Temporary OAuth Test Section */}
        <OAuthTestSection />
      </div>
      
      <div className='border-t border-border pt-8'>
        <ThemeTest />
      </div>
    </div>
  );
}
