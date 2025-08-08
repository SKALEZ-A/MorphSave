import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { faker } from '@faker-js/faker';

export async function POST(request: NextRequest) {
  try {
    // Get demo users
    const demoUsers = await prisma.user.findMany({
      where: {
        email: {
          contains: '@demo.com'
        }
      }
    });

    if (demoUsers.length === 0) {
      return NextResponse.json(
        { error: 'No demo users found. Please create demo data first.' },
        { status: 400 }
      );
    }

    // Create 5-10 new transactions for random demo users
    const transactionCount = faker.number.int({ min: 5, max: 10 });
    const transactions = [];

    for (let i = 0; i < transactionCount; i++) {
      const user = faker.helpers.arrayElement(demoUsers);
      const transactionType = faker.helpers.arrayElement(['roundup', 'manual', 'yield']);
      
      let amount: number;
      switch (transactionType) {
        case 'roundup':
          amount = faker.number.float({ min: 0.25, max: 4.75, fractionDigits: 2 });
          break;
        case 'manual':
          amount = faker.number.float({ min: 5.00, max: 100.00, fractionDigits: 2 });
          break;
        case 'yield':
          amount = faker.number.float({ min: 0.10, max: 5.00, fractionDigits: 2 });
          break;
        default:
          amount = 1.00;
      }

      const transaction = await prisma.savingsTransaction.create({
        data: {
          id: faker.string.uuid(),
          userId: user.id,
          type: transactionType as any,
          amount,
          currency: 'USD',
          blockchainTxHash: faker.string.hexadecimal({ length: 64 }),
          status: 'confirmed',
          originalTransactionAmount: transactionType === 'roundup' 
            ? faker.number.float({ min: 5, max: 150, fractionDigits: 2 })
            : null,
          merchantName: transactionType === 'roundup' 
            ? faker.company.name()
            : null,
          category: transactionType === 'roundup'
            ? faker.helpers.arrayElement(['food', 'transport', 'shopping', 'entertainment', 'utilities'])
            : null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Update user's total saved amount
      await prisma.user.update({
        where: { id: user.id },
        data: {
          totalSaved: {
            increment: amount
          },
          updatedAt: new Date()
        }
      });

      transactions.push({
        user: user.username,
        type: transactionType,
        amount: `$${amount.toFixed(2)}`,
        timestamp: transaction.createdAt
      });
    }

    return NextResponse.json({
      success: true,
      message: `Created ${transactionCount} simulated transactions`,
      transactions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error simulating transactions:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to simulate transactions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}