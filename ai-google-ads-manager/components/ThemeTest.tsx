'use client'

import React from 'react';

export default function ThemeTest() {
  return (
    <div className='min-h-screen bg-background p-6'>
      <div className='max-w-6xl mx-auto space-y-12'>
        {/* Header */}
        <div className='text-center space-y-6'>
          <h1 className='text-heading animate-float'>AI Google Ads Manager</h1>
          <p className='text-xl text-muted-foreground mx-auto' style={{ maxWidth: '672px' }}>
            Modern, vibrant SaaS design with high contrast and professional
            styling
          </p>
        </div>

        {/* Buttons Section */}
        <div className='card'>
          <div className='card-header'>
            <h2 className='card-title'>Modern Button Variants</h2>
            <p className='card-description'>
              Enhanced buttons with gradients, shadows, and smooth animations
            </p>
          </div>
          <div className='card-content'>
            <div className='flex flex-wrap gap-6'>
              <button className='btn btn-primary'>Primary Button</button>
              <button className='btn btn-secondary'>Secondary Button</button>
              <button className='btn btn-accent'>Accent Button</button>
              <button className='btn btn-destructive'>
                Destructive Button
              </button>
              <button className='btn btn-outline'>Outline Button</button>
              <button className='btn btn-ghost'>Ghost Button</button>
              <button className='btn btn-gradient'>Gradient Button</button>
            </div>
          </div>
        </div>

        {/* SaaS Brand Colors */}
        <div className='card-gradient'>
          <div className='card-header'>
            <h2 className='text-3xl font-bold text-white'>SaaS Brand Colors</h2>
            <p className='text-white/80'>
              Vibrant, high-contrast color palette for modern applications
            </p>
          </div>
          <div className='card-content'>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-6'>
              <div className='text-center space-y-3'>
                <div className='w-full h-24 bg-saas-primary rounded-xl shadow-lg'></div>
                <p className='saas-brand-primary font-bold text-white'>
                  Primary
                </p>
              </div>
              <div className='text-center space-y-3'>
                <div className='w-full h-24 bg-saas-secondary rounded-xl shadow-lg'></div>
                <p className='saas-brand-secondary font-bold text-white'>
                  Secondary
                </p>
              </div>
              <div className='text-center space-y-3'>
                <div className='w-full h-24 bg-saas-accent rounded-xl shadow-lg'></div>
                <p className='saas-brand-accent font-bold text-white'>Accent</p>
              </div>
              <div className='text-center space-y-3'>
                <div className='w-full h-24 bg-saas-success rounded-xl shadow-lg'></div>
                <p className='saas-brand-success font-bold text-white'>
                  Success
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Metrics Dashboard */}
        <div className='space-y-6'>
          <h2 className='text-subheading text-gradient-primary'>
            Dashboard Metrics
          </h2>
          <div className='dashboard-grid'>
            <div className='saas-metric-card-primary animate-pulse-glow'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-white/80 text-sm font-medium'>
                    Total Impressions
                  </p>
                  <p className='text-3xl font-bold text-white'>125,847</p>
                </div>
                <div className='badge-gradient'>+12.5%</div>
              </div>
            </div>
            <div className='saas-metric-card-secondary'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-white/80 text-sm font-medium'>
                    Total Clicks
                  </p>
                  <p className='text-3xl font-bold text-white'>8,231</p>
                </div>
                <div className='badge badge-info'>+8.2%</div>
              </div>
            </div>
            <div className='saas-metric-card-accent'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-white/80 text-sm font-medium'>CTR</p>
                  <p className='text-3xl font-bold text-white'>6.54%</p>
                </div>
                <div className='badge badge-warning'>-2.1%</div>
              </div>
            </div>
            <div className='saas-metric-card shadow-glow'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Total Cost
                  </p>
                  <p className='text-3xl font-bold text-foreground'>$2,450</p>
                </div>
                <div className='badge badge-error'>+15.8%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Chart Container */}
        <div className='chart-container-gradient'>
          <div className='space-y-6'>
            <h3 className='text-2xl font-bold text-white'>
              Performance Analytics
            </h3>
            <div className='h-80 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20'>
              <div className='text-center space-y-4'>
                <div className='text-6xl'>📊</div>
                <p className='text-white/80 text-lg'>
                  Advanced charts ready for React 19 integration
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Form Elements */}
        <div className='card glass'>
          <div className='card-header'>
            <h2 className='card-title'>Modern Form Elements</h2>
            <p className='card-description'>
              Enhanced inputs with focus states and smooth animations
            </p>
          </div>
          <div className='card-content space-y-6'>
            <div className='space-y-2'>
              <label className='label'>Campaign Name</label>
              <input
                className='input'
                placeholder='Enter your campaign name...'
                type='text'
              />
            </div>
            <div className='space-y-2'>
              <label className='label'>Budget</label>
              <input className='input' placeholder='$0.00' type='number' />
            </div>
            <div className='space-y-2'>
              <label className='label'>Target Audience</label>
              <input
                className='input'
                placeholder='Demographics, interests...'
                type='text'
              />
            </div>
          </div>
          <div className='card-footer'>
            <div className='flex gap-4'>
              <button className='btn btn-primary'>Create Campaign</button>
              <button className='btn btn-outline'>Save Draft</button>
            </div>
          </div>
        </div>

        {/* Modern Badge Collection */}
        <div className='card'>
          <div className='card-header'>
            <h2 className='card-title'>Status Badges</h2>
            <p className='card-description'>
              Modern badge system with vibrant colors and ring effects
            </p>
          </div>
          <div className='card-content'>
            <div className='flex flex-wrap gap-4'>
              <div className='badge badge-primary'>Active Campaign</div>
              <div className='badge badge-success'>Performance+</div>
              <div className='badge badge-warning'>Needs Review</div>
              <div className='badge badge-error'>Budget Alert</div>
              <div className='badge badge-info'>New Feature</div>
              <div className='badge-gradient'>Premium</div>
            </div>
          </div>
        </div>

        {/* Loading States with Modern Animation */}
        <div className='card'>
          <div className='card-header'>
            <h2 className='card-title'>Loading States</h2>
            <p className='card-description'>
              Enhanced skeleton loading with shimmer animations
            </p>
          </div>
          <div className='card-content space-y-6'>
            <div className='space-y-3'>
              <div className='skeleton h-6 w-3/4'></div>
              <div className='skeleton h-6 w-1/2'></div>
              <div className='skeleton h-6 w-5/6'></div>
            </div>
            <div className='skeleton h-40 w-full rounded-xl'></div>
          </div>
        </div>

        {/* Gradient Text Examples */}
        <div className='card'>
          <div className='card-header'>
            <h2 className='card-title'>Typography Showcase</h2>
            <p className='card-description'>
              Modern typography with gradient effects and responsive sizing
            </p>
          </div>
          <div className='card-content space-y-8'>
            <h3 className='text-gradient-primary text-4xl font-bold'>
              Gradient Primary Text
            </h3>
            <h3 className='text-gradient-accent text-3xl font-semibold'>
              Gradient Accent Text
            </h3>
            <p className='text-responsive'>
              This is responsive text that adapts to different screen sizes with
              modern font stacks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
