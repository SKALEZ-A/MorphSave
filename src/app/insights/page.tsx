'use client';

import React from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import { InsightsPanel } from '../../components/insights/InsightsPanel';

export default function InsightsPage() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <InsightsPanel />
        </div>
      </div>
    </MainLayout>
  );
}