'use client'

import React from 'react'
import { BarChart, Card, Title, Text } from '@tremor/react'

// Minimal test data
const testData = [
  { name: 'Item 1', value: 100 },
  { name: 'Item 2', value: 80 },
  { name: 'Item 3', value: 60 },
]

export default function TremorDebugPage() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Tremor BarChart Color Debug</h1>

      {/* Test 1: No colors specified */}
      <Card>
        <Title>Test 1: Default (no colors prop)</Title>
        <BarChart
          data={testData}
          index="name"
          categories={['value']}
          className="h-48"
        />
      </Card>

      {/* Test 2: Single color */}
      <Card>
        <Title>Test 2: Single color - blue</Title>
        <BarChart
          data={testData}
          index="name"
          categories={['value']}
          colors={['blue']}
          className="h-48"
        />
      </Card>

      {/* Test 3: HEX color */}
      <Card>
        <Title>Test 3: HEX color - #3b82f6</Title>
        <BarChart
          data={testData}
          index="name"
          categories={['value']}
          colors={['#3b82f6']}
          className="h-48"
        />
      </Card>

      {/* Test color classes */}
      <Card>
        <Title>Test 4: Tailwind color classes</Title>
        <div className="grid grid-cols-5 gap-2 mt-4">
          <div className="h-16 bg-blue-500"></div>
          <div className="h-16 bg-emerald-500"></div>
          <div className="h-16 bg-rose-500"></div>
          <div className="h-16 bg-violet-500"></div>
          <div className="h-16 bg-amber-500"></div>
        </div>
      </Card>

      {/* Test fill classes */}
      <Card>
        <Title>Test 5: SVG fill classes</Title>
        <div className="flex gap-4">
          <svg className="w-16 h-16">
            <rect width="100%" height="100%" className="fill-blue-500" />
          </svg>
          <svg className="w-16 h-16">
            <rect width="100%" height="100%" className="fill-emerald-500" />
          </svg>
          <svg className="w-16 h-16">
            <rect width="100%" height="100%" className="fill-rose-500" />
          </svg>
        </div>
      </Card>

      {/* Import our custom BarChart */}
      <Card>
        <Title>Test 6: Custom BarChart Component</Title>
        <CustomBarChartTest />
      </Card>
    </div>
  )
}

// Test with our custom BarChart component
import { BarChart as CustomBarChart } from '@/components/dashboard'

function CustomBarChartTest() {
  const data = [
    { name: 'Campaign A', clicks: 100 },
    { name: 'Campaign B', clicks: 80 },
    { name: 'Campaign C', clicks: 60 },
  ]

  return (
    <CustomBarChart
      data={data}
      metric="clicks"
      height="h-48"
      color="emerald"
    />
  )
}