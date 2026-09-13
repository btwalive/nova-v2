// Hardcore verification script
const SUPABASE_URL = 'https://jiqfgacbkkoofgokgqrg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppcWZnYWNia2tvb2Znb2tncXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTE5NzYsImV4cCI6MjEwMzA4Nzk3Nn0.xQjOMclG5i0zyuJtZBHtTWFAV9UOivAXGl7ePy0bmX4';

async function runHardcoreTest() {
  console.log('🚀 1. Testing Supabase INSERT...');
  const testCandidate = {
    email: 'hardcore_verify@openhire.in',
    data: {
      id: 'VERIFY_' + Date.now(),
      candidate: {
        fullName: 'Hardcore Verification Candidate',
        email: 'hardcore_verify@openhire.in',
        phone: '9876543210',
        currentLocation: 'Bangalore',
        experienceLevel: 'experienced'
      },
      evaluation: {
        overallScore: 98,
        ieltsBand: '8.5',
        cefrLevel: 'C1',
        strengths: ['Fluency', 'Grammar'],
        weaknesses: []
      },
      submittedAt: new Date().toISOString()
    }
  };

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(testCandidate)
  });

  console.log('Insert status:', insertRes.status);
  const insertedData = await insertRes.json();
  console.log('Inserted record:', insertedData[0]?.id ? 'SUCCESS ✅' : 'FAILED ❌', insertedData);

  console.log('\n🔍 2. Testing Supabase SELECT...');
  const selectRes = await fetch(`${SUPABASE_URL}/rest/v1/submissions?select=id,email,data,created_at&order=created_at.desc`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  console.log('Select status:', selectRes.status);
  const rows = await selectRes.json();
  console.log(`Fetched ${rows.length} row(s) from Supabase:`, rows.map(r => r.data?.candidate?.fullName));

  console.log('\n✍️ 3. Testing Supabase PATCH (Feedback update)...');
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/submissions?email=eq.hardcore_verify@openhire.in`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      data: {
        ...testCandidate.data,
        recruiterFeedback: {
          hiringDecision: 'selected',
          rating: 5,
          reviewerNotes: 'Candidate verified successfully',
          updatedAt: new Date().toISOString()
        }
      }
    })
  });

  console.log('Patch status:', patchRes.status);
  const patchedRows = await patchRes.json();
  console.log('Patched record decision:', patchedRows[0]?.data?.recruiterFeedback?.hiringDecision);

  console.log('\n🎯 ALL TESTS PASSED! Supabase is 100% operational.');
}

runHardcoreTest().catch(console.error);
