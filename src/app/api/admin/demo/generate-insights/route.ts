import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { faker } from '@faker-js/faker';

interface InsightData {
  user: string;
  insights: {
    spendingAnalysis: string;
    recommendation: string;
    projection: string;
    anomaly?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get demo users with their transaction history
    const demoUsers = await prisma.user.findMany({
      where: {
        email: {
          contains: '@demo.com'
        }
      },
      include: {
        savingsTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    if (demoUsers.length === 0) {
      return NextResponse.json(
        { error: 'No demo users found. Please create demo data first.' },
        { status: 400 }
      );
    }

    const generatedInsights: InsightData[] = [];

    // Pre-defined insight templates for realistic demo data
    const spendingAnalysisTemplates = [
      "Your spending on food & dining has increased 15% this month. Consider meal planning to optimize costs.",
      "Transportation costs are well within budget. Your round-up savings from commute purchases are performing excellently.",
      "Entertainment spending shows a healthy balance. Your weekend activities generate consistent round-up opportunities.",
      "Shopping expenses have decreased 8% compared to last month. Great job staying disciplined!",
      "Utility payments are consistent and predictable. Consider setting up automatic round-ups for these transactions."
    ];

    const recommendationTemplates = [
      "Based on your patterns, increasing your round-up amount to $3 could boost savings by $45/month.",
      "Your consistent coffee purchases suggest a $25/week coffee challenge could be highly effective.",
      "Consider joining the 'Lunch Savings Challenge' - your dining patterns show great potential for group motivation.",
      "Your weekend spending spikes suggest setting a Saturday spending limit with automatic round-ups.",
      "Your steady transaction volume indicates you're ready for the next savings milestone challenge."
    ];

    const projectionTemplates = [
      "At your current pace, you'll reach $5,000 in savings by December 2024.",
      "Your savings trajectory suggests hitting the $1,000 milestone within 3 months.",
      "With consistent round-ups, you're on track to save $2,400 annually.",
      "Your current streak puts you 2 weeks away from the 'Century Streak' achievement.",
      "Based on yield performance, your savings could grow to $3,200 by year-end."
    ];

    const anomalyTemplates = [
      "Unusual spending spike detected on Friday - $127 above your typical daily average.",
      "Your round-up frequency dropped 40% this week. Everything okay?",
      "Detected a new merchant category in your transactions - 'Home Improvement' spending increased.",
      "Your savings rate accelerated 25% this month - great momentum!",
      null // Some users won't have anomalies
    ];

    for (const user of demoUsers) {
      const insights = {
        spendingAnalysis: faker.helpers.arrayElement(spendingAnalysisTemplates),
        recommendation: faker.helpers.arrayElement(recommendationTemplates),
        projection: faker.helpers.arrayElement(projectionTemplates),
        anomaly: faker.helpers.arrayElement(anomalyTemplates)
      };

      // Store insights in a hypothetical insights table (or user metadata)
      // For demo purposes, we'll just return the generated insights
      generatedInsights.push({
        user: user.username,
        insights: insights.anomaly ? insights : { ...insights, anomaly: undefined }
      });

      // Update user's last activity to show fresh insights
      await prisma.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Generated fresh AI insights for ${demoUsers.length} demo users`,
      insights: generatedInsights,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate insights',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}