const SUPABASE_BASE = 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/';

const candidates = {
  246: [
    'audio/september/03 - Message2Me.wav',
    'audio/september/03 - message2me.wav',
    'audio/september/03 - Message2Me.mp3',
    'audio/september/03 - message2me.mp3',
    'audio/september/message2me.wav',
    'audio/september/message2me.mp3',
    'audio/september/03 - Message 2 Me.wav',
    'audio/september/03 - Message 2 Me.mp3',
    'audio/september/03-Message2Me.wav',
    'audio/september/03-Message2Me.mp3',
    'audio/september/03 - message 2 me.wav'
  ],
  278: [
    'audio/october/05 - you_just_dont_know.wav',
    'audio/october/05 - you_just_dont_know.mp3',
    'audio/october/05 - you just dont know.wav',
    'audio/october/05 - you just dont know.mp3',
    'audio/october/05 - You Just Don\'t Know.wav',
    'audio/october/05 - You Just Don\'t Know.mp3',
    'audio/october/05 - You Just Dont Know.wav',
    'audio/october/05 - You Just Dont Know.mp3',
    'audio/october/you_just_dont_know.wav',
    'audio/october/you_just_dont_know.mp3',
    'audio/october/05-you_just_dont_know.wav',
    'audio/october/05 - You_Just_Dont_Know.wav'
  ],
  364: [
    'audio/december/take my wheel_cyro.wav',
    'audio/december/30 - take my wheel_cyro.wav',
    'audio/december/30 - take my wheel_cyro.mp3',
    'audio/december/30 - Take My Wheel.wav',
    'audio/december/30 - Take My Wheel.mp3',
    'audio/december/take_my_wheel_cyro.wav',
    'audio/december/take_my_wheel_cyro.mp3',
    'audio/december/take my wheel.wav',
    'audio/december/take my wheel.mp3',
    'audio/december/30 - take_my_wheel_cyro.wav',
    'audio/december/30-take_my_wheel_cyro.wav',
    'audio/december/30 - Take My Wheel_cyro.wav',
    'audio/december/30 - take my wheel.wav'
  ]
};

async function testCandidates() {
  console.log('Testing candidates...');
  
  for (const day of Object.keys(candidates)) {
    console.log(`\n--- Day ${day} ---`);
    let found = false;
    for (const path of candidates[day]) {
      const url = SUPABASE_BASE + encodeURIComponent(path).replace(/%2F/g, '/');
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.status === 200) {
          console.log(`[FOUND] ${path}`);
          found = true;
        }
      } catch (err) {
        // ignore
      }
    }
    if (!found) {
      console.log(`[NOTHING FOUND] for Day ${day}`);
    }
  }
}

testCandidates().catch(console.error);
