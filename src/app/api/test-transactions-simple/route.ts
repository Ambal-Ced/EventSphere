import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  console.log('🧪 Testing transactions table access...');
  
  // Using imported supabase client

  try {
    // Test 1: Simple select to check if table exists
    console.log('🔍 Testing basic table access...');
    const { data: testData, error: testError } = await supabase
      .from('transactions')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Transactions table access error:', testError);
      return NextResponse.json({ 
        error: 'Transactions table access failed', 
        details: testError,
        errorCode: testError.code,
        errorMessage: testError.message
      }, { status: 500 });
    }

    console.log('✅ Transactions table accessible');

    // Test 2: Check table structure
    console.log('🔍 Checking table structure...');
    const { data: structureData, error: structureError } = await supabase
      .from('transactions')
      .select('*')
      .limit(0);

    if (structureError) {
      console.error('❌ Table structure check error:', structureError);
    } else {
      console.log('✅ Table structure check passed');
    }

    return NextResponse.json({ 
      success: true,
      message: 'Transactions table is accessible',
      testData: testData,
      structureCheck: structureError ? 'failed' : 'passed'
    });

  } catch (error) {
    console.error('❌ Test transactions error:', error);
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error 
    }, { status: 500 });
  }
}
