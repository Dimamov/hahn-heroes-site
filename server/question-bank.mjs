// Stable prompt identities are shared by every question-based activity.
const item=(prompt,answer,wrong,why)=>({id:prompt.toLowerCase().replace(/[^a-z0-9]/g,''),prompt,answer:String(answer),options:[String(answer),...wrong.map(String)].filter((v,i,a)=>a.indexOf(v)===i),why});
export function bank(grade){const out=[];for(let a=grade===6?31:2;a<=(grade===6?60:30);a++)for(let b=2;b<=12;b++){
 out.push(item(`What is ${a} × ${b}?`,a*b,[a+b,a*b+b],`${a} groups of ${b} contain ${a*b}.`));
 out.push(item(`What is ${a*b} ÷ ${b}?`,a,[a+1,b],`Division reverses multiplication: ${a} × ${b} = ${a*b}.`));
 out.push(item(`What is ${a}/10 written as a decimal?`,(a/10).toFixed(1),[(a/100).toFixed(2),String(a)],'Divide the numerator by 10.'));
 out.push(item(`A rectangle is ${a} units long and ${b} units wide. What is its area?`,a*b,[2*(a+b),a+b],'Area is length multiplied by width.'));
 out.push(item(`A rectangle is ${a} units long and ${b} units wide. What is its perimeter?`,2*(a+b),[a*b,a+b],'Add all four sides.'));
 out.push(item(`What is ${a*10+b} rounded to the nearest ten?`,Math.round((a*10+b)/10)*10,[a*10-10,a*10+20],'A ones digit of 5 or more rounds up.'));
 if(grade===6){out.push(item(`What is -${a} + ${b}?`,b-a,[a+b,a-b],'Move right on the number line when adding a positive number.'));out.push(item(`What is ${a} × (${b} + 3)?`,a*(b+3),[a*b+3,a*(b+2)],'Evaluate the parentheses first.'));out.push(item(`Which ratio is equivalent to ${a}:${b}?`,`${a*2}:${b*2}`,[`${a+2}:${b+2}`,`${a*2}:${b}`],'Multiply both parts by the same number.'));}
 }
 for(const [prompt,answer,wrong,why] of [
 ['Which gas do plants absorb during photosynthesis?','Carbon dioxide',['Helium','Hydrogen'],'Plants use carbon dioxide and water to make sugars.'],
 ['What force attracts objects toward Earth?','Gravity',['Friction','Sound'],'Gravity attracts objects with mass.'],
 ['What is the main job of roots?','Absorb water',['Make flowers','Catch sunlight'],'Roots absorb water and nutrients from soil.'],
 ['Which state of matter has a fixed volume but takes the shape of its container?','Liquid',['Solid','Gas'],'Liquids flow while keeping their volume.'],
 ['Which word means the opposite of scarce?','Abundant',['Rare','Missing'],'Abundant means plentiful.'],
 ['Which word is a verb?','Discover',['Purple','Mountain'],'A verb can describe an action.'],
 ['Ana checked the map before choosing a trail. What helped her decide?','The map',['A coin toss','A guess'],'The sentence says she checked the map first.'],
 ['Which ocean is the largest?','Pacific',['Atlantic','Arctic'],'The Pacific covers the largest area.'],
 ['Who writes laws in the United States federal government?','Congress',['The Supreme Court','Governors'],'Congress is the federal legislative branch.'],
 ['Which planet is known as the Red Planet?','Mars',['Venus','Earth'],'Iron minerals make the surface of Mars look red.']
 ])if(grade===5)out.push(item(prompt,answer,wrong,why));const unique=[...new Map(out.map(q=>[q.id,q])).values()];if(grade===6){const earlier=new Set(bank(5).map(q=>q.id));return unique.filter(q=>!earlier.has(q.id))}return unique;}
export const questions5=bank(5).map(q=>[q.prompt,q.options,0,q.why,q.id]);
export const questions6=bank(6).map(q=>[q.prompt,q.options,0,q.why,q.id]);
export const words='NEXUS HERO PORTAL SHADOW MISSION SQUAD COURAGE KINDNESS DISCOVERY COMPASS PLANET GRAVITY OCEAN FOREST CRYSTAL SCIENCE FRACTION DECIMAL NUMBER PATTERN ENERGY MATTER SOLID LIQUID ANIMAL MAMMAL REPTILE INSECT BUTTERFLY ELEPHANT DOLPHIN CHEETAH CHICKEN SPARROW CARDINAL PENGUIN LIBRARY CLASSROOM NOTEBOOK PENCIL ERASER BACKPACK TEACHER STUDENT READING CHAPTER AUTHOR POETRY SENTENCE PARAGRAPH QUESTION ANSWER EVIDENCE OPINION HISTORY GEOGRAPHY COUNTRY CAPITAL CONGRESS CITIZEN COMMUNITY CULTURE TRADITION LANGUAGE MOUNTAIN VALLEY RIVER STREAM ISLAND VOLCANO EARTHQUAKE WEATHER CLIMATE RAINBOW SUNSHINE THUNDER LIGHTNING SNOWFLAKE TEMPERATURE SEASON SPRING SUMMER AUTUMN WINTER GARDEN FLOWER ROOT STEM LEAF SEED FRUIT APPLE ORANGE BANANA MANGO PEACH CHERRY STRAWBERRY BLUEBERRY WATERMELON PUMPKIN CARROT POTATO TOMATO CUCUMBER BROCCOLI SPINACH CELERY LETTUCE PEPPER ONION GARLIC RADISH TURNIP BEET OLIVE COCONUT APRICOT AVOCADO LEMON LIME PEAR PLUM GRAPE MELON PAPAYA PINEAPPLE GUAVA FIG DATE KIWI NECTARINE RASPBERRY BLACKBERRY CRANBERRY'.split(' ');
