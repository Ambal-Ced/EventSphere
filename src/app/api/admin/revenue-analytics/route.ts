import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Admin Revenue Analytics - Request received');

    // Check for admin authentication
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET;
    
    if (adminSecret && authHeader !== `Bearer ${adminSecret}`) {
      console.error('❌ Unauthorized admin request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all transactions for admin analytics
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('status', 'paid')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching transactions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // Calculate analytics
    const analytics = {
      totalTransactions: transactions.length,
      totalRevenue: transactions.reduce((sum, t) => sum + t.net_amount_cents, 0),
      revenueByPlan: {} as Record<string, { count: number; revenue: number }>,
      revenueByPaymentMethod: {} as Record<string, { count: number; revenue: number }>,
      recentTransactions: transactions.slice(0, 10).map(t => ({
        id: t.id,
        invoice_number: t.invoice_number,
        user_id: t.user_id,
        plan_name: t.plan_name,
        amount: t.net_amount_cents,
        payment_method: `${t.payment_method_brand} •••• ${t.payment_method_last4}`,
        created_at: t.created_at
      }))
    };

    // Group by plan
    transactions.forEach(transaction => {
      const planName = transaction.plan_name || 'Unknown';
      if (!analytics.revenueByPlan[planName]) {
        analytics.revenueByPlan[planName] = { count: 0, revenue: 0 };
      }
      analytics.revenueByPlan[planName].count++;
      analytics.revenueByPlan[planName].revenue += transaction.net_amount_cents;
    });

    // Group by payment method
    transactions.forEach(transaction => {
      const paymentMethod = transaction.payment_method_brand || 'Unknown';
      if (!analytics.revenueByPaymentMethod[paymentMethod]) {
        analytics.revenueByPaymentMethod[paymentMethod] = { count: 0, revenue: 0 };
      }
      analytics.revenueByPaymentMethod[paymentMethod].count++;
      analytics.revenueByPaymentMethod[paymentMethod].revenue += transaction.net_amount_cents;
    });

    // Convert cents to pesos for display
    const formatAnalytics = {
      ...analytics,
      totalRevenuePesos: (analytics.totalRevenue / 1000).toFixed(2),
      revenueByPlan: Object.entries(analytics.revenueByPlan).reduce((acc, [plan, data]) => {
        acc[plan] = {
          count: data.count,
          revenue: data.revenue,
          revenuePesos: (data.revenue / 1000).toFixed(2)
        };
        return acc;
      }, {} as Record<string, { count: number; revenue: number; revenuePesos: string }>),
      revenueByPaymentMethod: Object.entries(analytics.revenueByPaymentMethod).reduce((acc, [method, data]) => {
        acc[method] = {
          count: data.count,
          revenue: data.revenue,
          revenuePesos: (data.revenue / 1000).toFixed(2)
        };
        return acc;
      }, {} as Record<string, { count: number; revenue: number; revenuePesos: string }>),
      recentTransactions: analytics.recentTransactions.map(t => ({
        ...t,
        amountPesos: (t.amount / 1000).toFixed(2)
      }))
    };

    console.log('✅ Admin analytics generated:', {
      totalTransactions: formatAnalytics.totalTransactions,
      totalRevenue: formatAnalytics.totalRevenuePesos
    });

    return NextResponse.json({
      success: true,
      data: formatAnalytics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Admin Revenue Analytics Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
