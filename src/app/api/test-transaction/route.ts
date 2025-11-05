export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  console.log('🧪 Testing transaction table access...');
  
  // Using imported supabase client

  try {
    // Test 1: Check if transactions table exists
    console.log('🔍 Testing transactions table access...');
    const { data: testData, error: testError } = await supabase
      .from('transactions')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Transactions table access error:', testError);
      return NextResponse.json({ 
        error: 'Transactions table access failed', 
        details: testError 
      }, { status: 500 });
    }

    console.log('✅ Transactions table accessible');

    // Test 2: Try to insert a test transaction
    console.log('🔍 Testing transaction insert...');
    const testTransaction = {
      user_id: 'test-user-id',
      invoice_number: 'TEST-001', // Add invoice number
      original_amount_cents: 100000,
      net_amount_cents: 100000,
      currency: 'PHP',
      payment_method_type: 'card',
      payment_method_brand: 'visa',
      payment_method_last4: '1234',
      status: 'paid',
      transaction_type: 'purchase',
      plan_name: 'Test Plan',
      metadata: { test: true }
    };

    const { data: insertData, error: insertError } = await supabase
      .from('transactions')
      .insert(testTransaction)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Transaction insert error:', insertError);
      return NextResponse.json({ 
        error: 'Transaction insert failed', 
        details: insertError 
      }, { status: 500 });
    }

    console.log('✅ Test transaction inserted successfully:', insertData);

    // Test 3: Clean up test transaction
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', insertData.id);

    if (deleteError) {
      console.error('⚠️ Failed to clean up test transaction:', deleteError);
    } else {
      console.log('✅ Test transaction cleaned up');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Transaction table is working correctly',
      testTransaction: insertData
    });

  } catch (error) {
    console.error('❌ Test transaction error:', error);
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error 
    }, { status: 500 });
  }
}
