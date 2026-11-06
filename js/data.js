// The Golden Child — content data
// All characters are adults (19–24) home for Thanksgiving, 1995.

export const SIBLINGS = [
  {
    id: 'chad',
    name: 'Chad',
    age: 24,
    tag: 'The Golden Boy',
    blurb: 'Varsity jacket. Firm handshake. Dad’s “obvious” favorite.',
    perk: 'HEAD START',
    perkDesc: 'Begins with +8 approval.',
    color: '#ffcf4a',
    color2: '#2f5bd0',
    skin: '#efbf96',
    hair: '#e3bf67',
    shirt: '#2f5bd0',
    pants: '#2b3c66',
    shoe: '#f4f1e6',
    hairStyle: 'swoop',
    choice: 'truth',
    startBonus: 8
  },
  {
    id: 'brad',
    name: 'Brad',
    age: 22,
    tag: 'The Try-Hard',
    blurb: 'Sweater vest. Laminated résumé. Has read the family rules.',
    perk: 'OVERACHIEVER',
    perkDesc: 'Perfect results earn +1 extra approval.',
    color: '#9ed36a',
    color2: '#6f8f4f',
    skin: '#d99a6c',
    hair: '#7a5436',
    shirt: '#6f8f4f',
    pants: '#5a5347',
    shoe: '#3d3129',
    hairStyle: 'short',
    choice: 'truth',
    perfectBonus: 1
  },
  {
    id: 'tad',
    name: 'Tad',
    age: 21,
    tag: 'The Wild Card',
    blurb: 'Tie-dye. Backwards cap. Once licked a flagpole on a dare.',
    perk: 'TEFLON KID',
    perkDesc: 'Failed challenges cost 4 less approval.',
    color: '#ff8fa8',
    color2: '#ff5b49',
    skin: '#b97850',
    hair: '#3b2a22',
    shirt: '#e05a48',
    pants: '#4f6b4f',
    shoe: '#efe0c4',
    hairStyle: 'cap',
    choice: 'dare',
    failShield: 4
  },
  {
    id: 'stacy',
    name: 'Stacy',
    age: 21,
    tag: 'The Favorite?',
    blurb: 'Denim jacket. Debate team captain. Knows where the bodies are buried.',
    perk: 'DAD’S SOFT SPOT',
    perkDesc: 'Truth sweet spot is wider. Dares are easier.',
    color: '#c7a3ff',
    color2: '#6c2bd9',
    skin: '#f0b58e',
    hair: '#5b3b2a',
    shirt: '#5b7fae',
    pants: '#33445f',
    shoe: '#f1e7d8',
    hairStyle: 'ponytail',
    choice: 'dare',
    easyMode: true
  }
];

export const ROUNDS = [
  { num: 1, name: 'THE WARM-UP', line: 'Dad has finished his coffee. This is as nice as he gets.' },
  { num: 2, name: 'THE DOUBLE DOWN', line: 'The pie is still on the counter. Nobody has earned it yet.' },
  { num: 3, name: 'THE PRESSURE COOKER', line: 'Dad just loosened his belt. That is not a good sign.' },
  { num: 4, name: 'THE FINAL SLICE', line: 'One round left. Someone is leaving this room a favorite.' }
];

export const TRUTHS = [
  'Who put the empty milk jug back in the fridge?',
  'Who borrowed my lucky tie without asking?',
  'Who told Grandma the turkey was “store-bought”?',
  'Who racked up $74 on the pay-per-view channel?',
  'Who broke the garage window and blamed the raccoon?',
  'Who ate the last Hot Pocket at 2 a.m.?',
  'Who used my calling card to call a girl in Canada?',
  'Who taped over my recording of the Super Bowl?',
  'Who put a dent in the family station wagon?',
  'Who told the neighbors I sing in the shower?',
  'Who used my good towel to dry the dog?',
  'Who lost the TV remote for three entire weeks?'
];

export const DARES = [
  'Do the Macarena on the coffee table. With feeling.',
  'Sing the entire Fresh Prince theme. Every word.',
  'Let Dad give you a haircut with the kitchen scissors.',
  'Call the pizza place and order “one large victory.”',
  'Do ten push-ups while yelling “I love this family!”',
  'Wear the turkey baster on your head for one full round.',
  'Reenact your most embarrassing childhood photo.',
  'Beat Dad at a staring contest. He never blinks.',
  'Do your best impression of Dad after three cups of coffee.',
  'Moonwalk across the rug in socks. No excuses.',
  'Let Stacy draw a tattoo on your forehead with a marker.',
  'Perform a dramatic reading of the TV Guide.'
];

export const DAD_SUCCESS = [
  'Huh. You actually did it. I’m writing this down.',
  'That’s my kid. Don’t tell the others.',
  'Approved. Barely. Don’t let it go to your head.',
  'I’d give you a hug, but I’m comfortable.',
  'You get one (1) nod of respect.',
  'Fine. You may remain in the will.',
  'That was almost impressive. Almost.'
];

export const DAD_PERFECT = [
  'Perfect? In THIS economy?',
  'I’m putting this on the fridge. Next to the warranty.',
  'Okay, show-off. The trophy shelf has room.',
  'I have never been prouder. Don’t make me say it twice.',
  'Textbook. Frame it. Sell the frame.',
  'That’s going in the family newsletter.'
];

export const DAD_FAIL = [
  'That’s a slippin’.',
  'I’ve seen better. At the DMV.',
  'You just bought yourself a one-way ticket to Slipper Town.',
  'Your mother would be disappointed. I’m just getting the slipper.',
  'Pathetic. The dog could do better. We don’t have a dog.',
  'I expected nothing and I’m still disappointed.',
  'Hold still. This hurts me more than it hurts you. (It doesn’t.)'
];

export const SLAP_QUIPS = [
  'Assemble the Slipper of Justice!',
  'This is gonna sting in 1995.',
  'Aim for the family crest!',
  'Noogies are for amateurs.',
  'Foam! It’s foam! ...Mostly.',
  'This is called “character building.”',
  'One for the road, kiddo.'
];

export const DARE_TAUNTS = [
  'Faster. The dog is embarrassed.',
  'My grandmother taps harder than that.',
  'Is that all you’ve got?',
  'The pie is getting cold.',
  'You call that effort?',
  'Keep going. I’m not impressed yet.'
];

export function byId(id) {
  return SIBLINGS.find((s) => s.id === id);
}

export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}
