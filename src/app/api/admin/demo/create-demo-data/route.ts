import { NextRequest, NextResponse } from 'next/server';
import { createDemoData } from '@/scripts/create-demo-data';

export async function POST(request: NextRequest) {
  try {
    await createDemoData();
    
    return NextResponse.json({
      success: true,
      message: 'Demo data created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating demo data:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create demo data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}