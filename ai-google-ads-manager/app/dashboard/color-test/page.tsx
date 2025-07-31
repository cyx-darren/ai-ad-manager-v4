'use client'

import React from 'react'
import { BarChart, Card, Title, Text } from '@tremor/react'

const testData = [
  { name: 'Blue Test', value: 100 },
  { name: 'Emerald Test', value: 85 },
  { name: 'Rose Test', value: 70 },
  { name: 'Violet Test', value: 55 },
  { name: 'Amber Test', value: 40 },
]

export default function ColorTestPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-4">Tremor Color Test</h1>
        <p className="text-gray-600 mb-8">Testing different color configurations for Tremor charts</p>
      </div>

      {/* Test 1: Using Tremor default colors */}
      <Card>
        <Title>Test 1: Default Tremor Colors</Title>
        <Text>Using color names without array</Text>
        <BarChart
          data={testData}
          index="name"
          categories={['value']}
          className="h-64 mt-4"
        />
      </Card>

      {/* Test 2: Using color array with Tremor color names */}
      <Card>
        <Title>Test 2: Tremor Color Names in Array</Title>
        <Text>colors={`['blue', 'emerald', 'rose', 'violet', 'amber']`}</Text>
        <BarChart
          data={testData}
          index="name"
          categories={['value']}
          colors={['blue', 'emerald', 'rose', 'violet', 'amber']}
          className="h-64 mt-4"
        />
      </Card>

      {/* Test 3: Using HEX colors */}
      <Card>
        <Title>Test 3: HEX Colors</Title>
        <Text>colors={`['#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#f59e0b']`}</Text>
        <BarChart
          data={testData}
          index="name"
          categories={['value']}
          colors={['#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#f59e0b']}
          className="h-64 mt-4"
        />
      </Card>

      {/* Test 4: Multiple categories with colors */}
      <Card>
        <Title>Test 4: Multiple Categories</Title>
        <Text>Testing multiple data series with colors</Text>
        <BarChart
          data={[
            { name: 'Campaign A', clicks: 100, conversions: 20, cost: 150 },
            { name: 'Campaign B', clicks: 85, conversions: 15, cost: 120 },
            { name: 'Campaign C', clicks: 70, conversions: 25, cost: 180 },
          ]}
          index="name"
          categories={['clicks', 'conversions', 'cost']}
          colors={['blue', 'emerald', 'rose']}
          className="h-64 mt-4"
        />
      </Card>

      {/* Color Palette Display */}
      <Card>
        <Title>Tremor Color Palette</Title>
        <Text>Available colors for charts</Text>
        <div className="grid grid-cols-4 gap-4 mt-4">
          {['blue', 'emerald', 'violet', 'amber', 'rose', 'cyan', 'indigo', 'orange', 'purple', 'green', 'red', 'yellow', 'pink', 'teal'].map(color => (
            <div key={color} className="text-center">
              <div className={`h-16 rounded bg-${color}-500 mb-2`} />
              <p className="text-sm font-medium">{color}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Tailwind Color Classes Test */}
      <Card>
        <Title>Tailwind Color Classes</Title>
        <Text>Testing if Tailwind color classes are being generated</Text>
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="fill-blue-500 bg-blue-100 p-4 rounded">fill-blue-500</div>
          <div className="fill-emerald-500 bg-emerald-100 p-4 rounded">fill-emerald-500</div>
          <div className="fill-rose-500 bg-rose-100 p-4 rounded">fill-rose-500</div>
          <div className="fill-violet-500 bg-violet-100 p-4 rounded">fill-violet-500</div>
        </div>
      </Card>
    </div>
  )
}