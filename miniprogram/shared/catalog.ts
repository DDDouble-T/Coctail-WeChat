import type { Cocktail, Family, IbaCategory, Ingredient, IngredientGroup, IngredientLine, Style } from './types';
import { ibaImageSources } from './iba-image-sources';

export const CATALOG_VERSION = '2026-10-30.2';

export const familyOptions: Array<{ id: Family | 'all'; label: string; english: string }> = [
  { id: 'all', label: '全部', english: 'All' },
  { id: 'sour', label: '酸酒', english: 'Sour' },
  { id: 'fizz', label: '菲兹', english: 'Fizz' },
  { id: 'collins', label: '柯林斯', english: 'Collins' },
  { id: 'highball', label: '高球', english: 'Highball' },
  { id: 'old_fashioned', label: '古典', english: 'Old Fashioned' },
  { id: 'martini', label: '马天尼', english: 'Martini' },
  { id: 'daisy', label: '黛西', english: 'Daisy' },
];

export const ingredientGroups: Array<{ id: IngredientGroup; label: string; english: string }> = [
  { id: 'base', label: '基酒', english: 'Spirits' },
  { id: 'liqueur', label: '利口酒与味美思', english: 'Liqueurs' },
  { id: 'syrup', label: '糖浆甜料', english: 'Sweeteners' },
  { id: 'citrus', label: '果汁与果泥', english: 'Fruit' },
  { id: 'mixer', label: '软饮与辅料', english: 'Mixers' },
  { id: 'garnish', label: '装饰与香草', english: 'Garnish & Herbs' },
];

export const styleLabels: Record<Style, string> = {
  shake: '摇和', stir: '搅拌', build: '杯中直调', blend: '搅打',
};

export const ibaLabels: Record<IbaCategory, string> = {
  unforgettables: '难忘经典', contemporary_classics: '当代经典', new_era: '新纪元',
};

function ingredient(id: string, name_zh: string, name_en: string, group: IngredientGroup, aliases: string[] = []): Ingredient {
  // 共享数据的 ID 也会写入 TCB；统一使用校验器允许的短横线格式。
  return { id: id.replace(/_/g, '-'), name_zh, name_en, group, aliases };
}

// 同义词只归一名称；波本、黑麦、不同朗姆及风味伏特加保留独立 ID。
export const ingredients: Ingredient[] = [
  ingredient('gin', '金酒', 'Gin', 'base', ['琴酒', '杜松子酒', 'Dry Gin', 'London Dry Gin']),
  ingredient('bourbon', '波本威士忌', 'Bourbon Whiskey', 'base', ['波本', 'Bourbon', 'Bourbon Whisky']),
  ingredient('rye_whiskey', '黑麦威士忌', 'Rye Whiskey', 'base', ['黑麦', 'Rye Whisky', 'Rye']),
  ingredient('scotch', '苏格兰威士忌', 'Scotch Whisky', 'base', ['Scotch', 'Scotch Whiskey']),
  ingredient('vodka', '伏特加', 'Vodka', 'base', ['原味伏特加', 'Smirnoff Vodka']),
  ingredient('citron_vodka', '柠檬风味伏特加', 'Vodka Citron', 'base', ['Citron Vodka', '柠檬伏特加']),
  ingredient('white_rum', '白朗姆酒', 'White Rum', 'base', ['白朗姆', '白兰姆', '白兰姆酒', 'Light Rum', 'White Cuban Rum', 'White Cuban Ron']),
  ingredient('goslings_rum', '高斯林黑朗姆酒', 'Goslings Black Seal Rum', 'base', ['Goslings Rum', "Gosling’s Black Seal Rum", 'Goslings Black Seal', '高斯林朗姆酒']),
  ingredient('jamaican_rum', '牙买加朗姆酒', 'Jamaican Rum', 'base', ['牙买加朗姆']),
  ingredient('cognac', '干邑白兰地', 'Cognac', 'base', ['干邑', 'Cognac Brandy']),
  ingredient('pisco', '皮斯科', 'Pisco', 'base', ['皮斯科白兰地']),
  ingredient('tequila', '100% 龙舌兰酒', '100% Agave Tequila', 'base', ['龙舌兰', '龙舌兰酒', 'Tequila', 'Tequila 100% Agave']),
  ingredient('sweet_vermouth', '甜红味美思', 'Sweet Red Vermouth', 'liqueur', ['甜味美思', '红味美思', 'Sweet Vermouth', 'Rosso Vermouth']),
  ingredient('dry_vermouth', '干味美思', 'Dry Vermouth', 'liqueur', ['干型味美思']),
  ingredient('campari', '金巴利', 'Campari', 'liqueur', ['Bitter Campari', '金巴利苦酒']),
  ingredient('triple_sec', '橙味利口酒', 'Triple Sec', 'liqueur', ['君度', '君度橙酒', 'Cointreau', '橙味力娇酒', '橙酒']),
  ingredient('coffee_liqueur', '咖啡利口酒', 'Coffee Liqueur', 'liqueur', ['咖啡力娇酒', '甘露', '甘露咖啡酒', 'Kahlua', 'Kahlúa']),
  ingredient('drambuie', '杜林标利口酒', 'Drambuie', 'liqueur', ['杜林标', '杜林标蜂蜜威士忌利口酒']),
  ingredient('absinthe', '苦艾酒', 'Absinthe', 'liqueur', ['艾碧斯']),
  ingredient('fernet', '菲奈特苦酒', 'Fernet', 'liqueur', ['Fernet Branca', 'Fernet-Branca', '菲奈特']),
  ingredient('aperol', '阿佩罗', 'Aperol', 'liqueur', ['阿佩罗开胃酒']),
  ingredient('maraschino', '黑樱桃利口酒', 'Maraschino Liqueur', 'liqueur', ['Maraschino', 'Maraschino Luxardo', 'Luxardo Maraschino', '马拉斯奇诺利口酒']),
  ingredient('violet_liqueur', '紫罗兰利口酒', 'Crème de Violette', 'liqueur', ['Creme de Violette', '紫罗兰力娇酒']),
  ingredient('simple_syrup', '单糖浆', 'Simple Syrup', 'syrup', ['糖浆', '糖水', 'Sugar Syrup', 'Gomme Syrup', 'Gum Syrup', '单糖糖浆']),
  ingredient('honey_syrup', '蜂蜜糖浆', 'Honey Syrup', 'syrup', ['蜂蜜糖水']),
  ingredient('sugar', '细砂糖', 'Superfine Sugar', 'syrup', ['白糖', '白砂糖', '蔗糖', 'White Cane Sugar', 'Caster Sugar', 'Sugar']),
  ingredient('sugar_cube', '方糖', 'Sugar Cube', 'syrup', ['Cube Sugar', '糖块']),
  ingredient('raspberry_syrup', '覆盆子糖浆', 'Raspberry Syrup', 'syrup', ['树莓糖浆']),
  ingredient('agave_nectar', '龙舌兰糖浆', 'Agave Nectar', 'syrup', ['Agave Syrup', '龙舌兰蜜']),
  ingredient('lemon_juice', '柠檬汁', 'Lemon Juice', 'citrus', ['柠檬', '黄柠檬', '黄柠檬汁', '鲜榨柠檬汁', 'Lemon', 'Fresh Lemon Juice', 'Freshly Squeezed Lemon Juice']),
  ingredient('lime_juice', '青柠汁', 'Lime Juice', 'citrus', ['青柠', '莱姆', '莱姆汁', '鲜榨青柠汁', 'Lime', 'Fresh Lime Juice', 'Freshly Squeezed Lime Juice']),
  ingredient('orange_juice', '橙汁', 'Orange Juice', 'citrus', ['鲜榨橙汁', 'Fresh Orange Juice', 'Freshly Squeezed Orange Juice']),
  ingredient('cranberry_juice', '蔓越莓汁', 'Cranberry Juice', 'citrus', ['蔓越莓果汁']),
  ingredient('pineapple_juice', '菠萝汁', 'Pineapple Juice', 'citrus', ['凤梨汁', 'Fresh Pineapple Juice']),
  ingredient('peach_puree', '白桃果泥', 'White Peach Puree', 'citrus', ['白桃泥', 'Peach Puree', 'White Peach Purée']),
  ingredient('sugarcane_juice', '甘蔗汁', 'Sugar Cane Juice', 'citrus', ['Sugarcane Juice']),
  ingredient('soda_water', '苏打水', 'Soda Water', 'mixer', ['气泡水', '苏打', 'Soda', 'Club Soda', 'Sparkling Water']),
  ingredient('ginger_beer', '姜汁啤酒', 'Ginger Beer', 'mixer', ['姜啤']),
  ingredient('ginger_ale', '干姜水', 'Ginger Ale', 'mixer', ['姜汁汽水', '姜汁苏打']),
  ingredient('grapefruit_soda', '粉红西柚汽水', 'Pink Grapefruit Soda', 'mixer', ['西柚汽水', 'Grapefruit Soda']),
  ingredient('cola', '可乐', 'Cola', 'mixer', ['Coca Cola', 'Coca-Cola']),
  ingredient('champagne', '香槟', 'Champagne', 'mixer', ['香槟酒']),
  ingredient('prosecco', '普罗塞克起泡酒', 'Prosecco', 'mixer', ['普罗塞克', 'Prosecco Wine']),
  ingredient('red_wine', '红葡萄酒', 'Red Wine', 'mixer', ['红酒', 'Shiraz', 'Malbec']),
  ingredient('cream', '鲜奶油', 'Cream', 'mixer', ['淡奶油', 'Heavy Cream', 'Fresh Cream']),
  ingredient('coconut_cream', '椰浆', 'Coconut Cream', 'mixer', ['椰子奶油', '椰奶油']),
  ingredient('egg_white', '蛋清', 'Egg White', 'mixer', ['鸡蛋清', '蛋白', 'Raw Egg White', 'Raw whole Egg White']),
  ingredient('orange_flower_water', '橙花水', 'Orange Flower Water', 'mixer', ['橙花露', 'Orange Blossom Water']),
  ingredient('vanilla_extract', '香草精', 'Vanilla Extract', 'mixer', ['香草提取液']),
  ingredient('angostura', '安格式苦精', 'Angostura Bitters', 'mixer', ['安格斯特拉苦精', 'Angostura Bitter', '安格仕苦精']),
  ingredient('peychaud', '佩肖苦精', 'Peychaud’s Bitters', 'mixer', ["Peychaud's Bitters", 'Peychaud Bitters', '佩氏苦精']),
  ingredient('amargo', '阿玛戈苦精', 'Amargo Bitters', 'mixer', ['Amargo', '秘鲁苦精']),
  ingredient('espresso', '意式浓缩咖啡', 'Espresso', 'mixer', ['浓缩咖啡', 'Strong Espresso']),
  ingredient('salt', '盐', 'Salt', 'mixer', ['食盐', '海盐']),
  ingredient('water', '饮用水', 'Plain Water', 'mixer', ['清水', 'Water']),
  ingredient('orange_peel', '橙皮', 'Orange Zest', 'garnish', ['橙皮卷', 'Orange Peel', 'Orange Twist']),
  ingredient('lemon_peel', '柠檬皮', 'Lemon Zest', 'garnish', ['柠檬皮卷', 'Lemon Peel', 'Lemon Twist']),
  ingredient('orange_slice', '橙片', 'Orange Slice', 'garnish', ['橙切片', 'Half Orange Slice']),
  ingredient('lemon_slice', '柠檬片', 'Lemon Slice', 'garnish', ['黄柠檬片']),
  ingredient('lime_slice', '青柠片', 'Lime Slice', 'garnish', ['莱姆片']),
  ingredient('lime_wedge', '青柠角', 'Lime Wedge', 'garnish', ['莱姆角']),
  ingredient('cocktail_cherry', '鸡尾酒樱桃', 'Maraschino Cherry', 'garnish', ['装饰樱桃', '红樱桃', 'Cocktail Cherry']),
  ingredient('mint', '薄荷', 'Mint', 'garnish', ['薄荷叶', '薄荷枝', 'Mint Leaves', 'Mint Sprigs', 'Mint Sprig']),
  ingredient('olive', '绿橄榄', 'Green Olive', 'garnish', ['橄榄', 'Olive', 'Green Olives']),
  ingredient('salt_rim', '盐边', 'Salt Rim', 'garnish', ['杯口盐边', 'Half Salt Rim']),
  ingredient('coffee_beans', '咖啡豆', 'Coffee Beans', 'garnish', ['Coffee Bean']),
  ingredient('pineapple_slice', '菠萝片', 'Pineapple Slice', 'garnish', ['凤梨片']),
  ingredient('raspberry', '覆盆子', 'Raspberry', 'garnish', ['树莓', 'Raspberries', 'Fresh Raspberries']),
];

const ingredientById = new Map(ingredients.map((entry) => [entry.id, entry]));

function line(id: string, amount: string, role: 'essential' | 'garnish' | 'optional' = 'essential'): IngredientLine {
  const canonicalId = id.replace(/_/g, '-');
  const item = ingredientById.get(canonicalId);
  if (!item) throw new Error(`Unknown ingredient: ${id}`);
  return {
    ingredient_id: canonicalId, name: item.name_zh, amount,
    // 当前共享模型只有“必备/可选（装饰）”两态；IBA 标注 Optional 的材料
    // 归入可选态，匹配时不阻止制作，且不会让云端结构校验失效。
    is_essential: role === 'essential', is_garnish: role === 'garnish' || role === 'optional',
  };
}

function recipe(input: Omit<Cocktail, 'source_url' | 'image_url' | 'image_original_url'>): Cocktail {
  const imageOriginalUrl = ibaImageSources[input.id];
  if (!imageOriginalUrl) throw new Error(`Missing IBA image source for ${input.id}; run npm run iba:images`);
  return {
    ...input,
    image_url: `/assets/cocktails/${input.id}-crayon.webp`,
    image_original_url: imageOriginalUrl,
    source_url: `https://iba-world.com/iba-cocktail/${input.id}/`,
  };
}

// 2026-10-30 逐页核对 IBA 官方用量和做法；文案为自有中文表达。
// 官方允许二选一的基酒，这里固定一个版本，避免把两种都误判为必需或可选。
export const cocktails: Cocktail[] = [
  recipe({
    id: 'whiskey-sour', name_zh: '威士忌酸', name_en: 'Whiskey Sour',
    iba_category: 'unforgettables', family: 'sour', glass: 'Rocks', style: 'shake', difficulty: 'easy',
    taste: '柠檬的明亮酸感，衬着波本的香草与橡木香。', healing_copy: '酸甜落在杯里，今天也慢一点。',
    ingredients: [line('bourbon', '45 ml'), line('lemon_juice', '25 ml'), line('simple_syrup', '20 ml'), line('egg_white', '数滴，可选', 'optional'), line('orange_slice', '半片', 'garnish'), line('cocktail_cherry', '1 颗', 'garnish')],
    steps: ['将波本、柠檬汁、单糖浆与冰块放入摇壶；喜欢泡沫时再加入可选蛋清。', '充分摇和；使用蛋清时多摇一会，让泡沫充分形成。', '滤入装有新冰块的古典杯，以半片橙片和鸡尾酒樱桃装饰。'],
  }),
  recipe({
    id: 'daiquiri', name_zh: '代基里', name_en: 'Daiquiri',
    iba_category: 'unforgettables', family: 'sour', glass: 'Coupe', style: 'shake', difficulty: 'easy',
    taste: '干净的朗姆酒香，包裹清爽直接的青柠酸甜。', healing_copy: '把复杂放下，留一杯简单的清爽。',
    ingredients: [line('white_rum', '60 ml'), line('lime_juice', '20 ml'), line('sugar', '2 吧勺')],
    steps: ['将白朗姆、青柠汁和细砂糖加入摇壶，先搅拌至糖溶解。', '加入冰块，充分摇和。', '滤入预先冰镇的鸡尾酒杯。'],
  }),
  recipe({
    id: 'pisco-sour', name_zh: '皮斯科酸', name_en: 'Pisco Sour',
    iba_category: 'contemporary_classics', family: 'sour', glass: 'Goblet', style: 'shake', difficulty: 'medium',
    taste: '葡萄蒸馏酒的花果香与绵密蛋白泡沫交织。', healing_copy: '像一朵软软的云，停在杯沿。',
    ingredients: [line('pisco', '60 ml'), line('lemon_juice', '30 ml'), line('simple_syrup', '20 ml'), line('egg_white', '1 个蛋清'), line('amargo', '数 dash（振）', 'garnish')],
    steps: ['将皮斯科、柠檬汁、单糖浆、蛋清与冰块放入摇壶。', '充分摇和，滤入冰镇的高脚杯。', '在泡沫表面点上少许阿玛戈苦精作为香气装饰。'],
  }),
  recipe({
    id: 'new-york-sour', name_zh: '纽约酸', name_en: 'New York Sour',
    iba_category: 'new_era', family: 'sour', glass: 'Rocks', style: 'shake', difficulty: 'medium',
    taste: '黑麦的辛香与红酒的果味，为酸甜添上柔和层次。', healing_copy: '杯里的落日，也有温柔的边界。',
    ingredients: [line('rye_whiskey', '60 ml'), line('simple_syrup', '22.5 ml'), line('lemon_juice', '30 ml'), line('egg_white', '数滴'), line('red_wine', '15 ml'), line('lemon_peel', '1 片', 'garnish'), line('cocktail_cherry', '1 颗', 'garnish')],
    steps: ['此处采用 IBA 允许的黑麦威士忌版本。将红酒以外的必备材料加冰充分摇和。', '滤入装有新冰块的古典杯。', '沿吧勺背缓慢倒入红酒，使其浮在表面；以柠檬皮和樱桃装饰。'],
  }),
  recipe({
    id: 'bees-knees', name_zh: '蜂之膝', name_en: 'Bee’s Knees',
    iba_category: 'new_era', family: 'sour', glass: 'Coupe', style: 'shake', difficulty: 'easy',
    taste: '蜂蜜的柔甜、柑橘的酸香与金酒草本平衡相遇。', healing_copy: '收起今天的忙碌，给心情一点蜜。',
    ingredients: [line('gin', '52.5 ml'), line('honey_syrup', '2 茶匙'), line('lemon_juice', '22.5 ml'), line('orange_juice', '22.5 ml'), line('lemon_peel', '1 片，可选', 'garnish')],
    steps: ['先将蜂蜜糖浆、柠檬汁与橙汁搅拌均匀。', '加入金酒和冰块，充分摇和。', '滤入冰镇鸡尾酒杯，可用柠檬皮装饰。'],
  }),
  recipe({
    id: 'clover-club', name_zh: '三叶草俱乐部', name_en: 'Clover Club',
    iba_category: 'unforgettables', family: 'sour', glass: 'Coupe', style: 'shake', difficulty: 'medium',
    taste: '覆盆子的果香酸甜，与轻盈蛋白泡沫一起绽开。', healing_copy: '粉色的小云朵，替你把烦恼盖好。',
    ingredients: [line('gin', '45 ml'), line('raspberry_syrup', '15 ml'), line('lemon_juice', '15 ml'), line('egg_white', '数滴'), line('raspberry', '少许', 'garnish')],
    steps: ['将金酒、覆盆子糖浆、柠檬汁、蛋清放入摇壶并加冰。', '充分摇和，滤入冰镇鸡尾酒杯。', '以新鲜覆盆子点缀。'],
  }),
  recipe({
    id: 'gin-fizz', name_zh: '金菲兹', name_en: 'Gin Fizz',
    iba_category: 'unforgettables', family: 'fizz', glass: 'Highball', style: 'shake', difficulty: 'easy',
    taste: '柠檬与金酒的清香，遇到轻快细小的气泡。', healing_copy: '让气泡轻轻响，把疲惫慢慢放。',
    ingredients: [line('gin', '45 ml'), line('lemon_juice', '30 ml'), line('simple_syrup', '10 ml'), line('soda_water', '少许'), line('lemon_slice', '1 片', 'garnish')],
    steps: ['将苏打水以外的必备材料加入摇壶，加冰摇和。', '滤入细长杯，加入少许苏打水。', '按 IBA 做法不在出品杯中留冰，以柠檬片装饰。'],
  }),
  recipe({
    id: 'ramos-fizz', name_zh: '拉莫斯菲兹', name_en: 'Ramos Fizz',
    iba_category: 'unforgettables', family: 'fizz', glass: 'Highball', style: 'shake', difficulty: 'advanced',
    taste: '绵密奶油与蛋白泡沫，带着橙花和香草的芬芳。', healing_copy: '多一点耐心，云朵就会浮起来。',
    ingredients: [line('gin', '45 ml'), line('lime_juice', '15 ml'), line('lemon_juice', '15 ml'), line('simple_syrup', '30 ml'), line('cream', '60 ml'), line('egg_white', '30 ml'), line('orange_flower_water', '3 dash（振）'), line('vanilla_extract', '2 滴'), line('soda_water', '补满')],
    steps: ['将苏打水以外的所有材料倒入摇壶，加冰摇和 2 分钟。', '双重过滤到杯中，再倒回无冰摇壶，用力摇和 1 分钟。', '倒入高球杯，缓慢加入苏打水形成绵密泡沫。'],
  }),
  recipe({
    id: 'french-75', name_zh: '法式 75', name_en: 'French 75',
    iba_category: 'contemporary_classics', family: 'fizz', glass: 'Flute', style: 'shake', difficulty: 'easy',
    taste: '香槟的清脆气泡，托起金酒与柠檬的明亮香气。', healing_copy: '给平常的一天，系一串小气泡。',
    ingredients: [line('gin', '30 ml'), line('lemon_juice', '15 ml'), line('simple_syrup', '15 ml'), line('champagne', '60 ml')],
    steps: ['将金酒、柠檬汁和单糖浆加冰摇和。', '滤入冰镇香槟笛形杯。', '加入香槟，轻轻搅拌；有气泡的酒不放进摇壶。'],
  }),
  recipe({
    id: 'john-collins', name_zh: '约翰柯林斯', name_en: 'John Collins',
    iba_category: 'unforgettables', family: 'collins', glass: 'Highball', style: 'build', difficulty: 'easy',
    taste: '金酒、柠檬和苏打的经典清爽组合，酸甜轻盈。', healing_copy: '窗边有风，杯里有一点晴天。',
    ingredients: [line('gin', '45 ml'), line('lemon_juice', '30 ml'), line('simple_syrup', '15 ml'), line('soda_water', '60 ml'), line('lemon_slice', '1 片', 'garnish'), line('cocktail_cherry', '1 颗', 'garnish')],
    steps: ['在高球杯中放入冰块。', '依次加入金酒、柠檬汁、单糖浆和苏打水，轻轻搅匀。', '以柠檬片和鸡尾酒樱桃装饰。'],
  }),
  recipe({
    id: 'cuba-libre', name_zh: '自由古巴', name_en: 'Cuba Libre',
    iba_category: 'contemporary_classics', family: 'highball', glass: 'Highball', style: 'build', difficulty: 'easy',
    taste: '可乐的焦糖香气，添入青柠后更加清爽。', healing_copy: '一角青柠，把寻常夜晚点亮。',
    ingredients: [line('white_rum', '50 ml'), line('cola', '120 ml'), line('lime_juice', '10 ml'), line('lime_wedge', '1 角', 'garnish')],
    steps: ['将白朗姆、可乐与青柠汁依次倒入装满冰块的高球杯。', '轻轻搅匀，用青柠角装饰。'],
  }),
  recipe({
    id: 'moscow-mule', name_zh: '莫斯科骡子', name_en: 'Moscow Mule',
    iba_category: 'contemporary_classics', family: 'highball', glass: 'Mule Cup', style: 'build', difficulty: 'easy',
    taste: '姜汁啤酒的辛香与青柠酸感，带来清脆口感。', healing_copy: '铜杯凉凉的，心情暖暖的。',
    ingredients: [line('vodka', '45 ml'), line('ginger_beer', '120 ml'), line('lime_juice', '10 ml'), line('lime_slice', '1 片', 'garnish')],
    steps: ['在装有冰块的骡子杯或古典杯中加入伏特加与姜汁啤酒。', '加入青柠汁并轻轻搅拌均匀。', '以青柠片装饰。'],
  }),
  recipe({
    id: 'dark-n-stormy', name_zh: '暗黑风暴', name_en: 'Dark ’n’ Stormy',
    iba_category: 'new_era', family: 'highball', glass: 'Highball', style: 'build', difficulty: 'easy',
    taste: '黑朗姆的厚实焦糖与姜汁啤酒的辛香相叠。', healing_copy: '杯中有风暴，窗边仍然安静。',
    ingredients: [line('goslings_rum', '60 ml'), line('ginger_beer', '100 ml'), line('lime_wedge', '1 角', 'garnish')],
    steps: ['高球杯中加满冰块，倒入姜汁啤酒。', '缓慢加入高斯林黑朗姆酒，使其浮在上层。', '以青柠角装饰。'],
  }),
  recipe({
    id: 'horses-neck', name_zh: '马颈', name_en: 'Horse’s Neck',
    iba_category: 'contemporary_classics', family: 'highball', glass: 'Highball', style: 'build', difficulty: 'easy',
    taste: '干邑的果香与干姜水相伴，清柔又有温度。', healing_copy: '一圈柠檬皮，圈住属于你的片刻。',
    ingredients: [line('cognac', '40 ml'), line('ginger_ale', '120 ml'), line('angostura', '少许，可选', 'optional'), line('lemon_peel', '整条螺旋皮', 'garnish')],
    steps: ['将干邑与干姜水倒入装有冰块的高球杯，轻轻搅拌。', '按喜好加入少许可选安格式苦精。', '以整条螺旋柠檬皮装饰。'],
  }),
  recipe({
    id: 'paloma', name_zh: '帕洛玛', name_en: 'Paloma',
    iba_category: 'new_era', family: 'highball', glass: 'Highball', style: 'build', difficulty: 'easy',
    taste: '西柚汽水的酸甜微苦，映出龙舌兰的草木香。', healing_copy: '粉红气泡，是傍晚寄来的一封信。',
    ingredients: [line('tequila', '50 ml'), line('lime_juice', '5 ml'), line('salt', '一小撮'), line('grapefruit_soda', '100 ml'), line('lime_slice', '1 片', 'garnish')],
    steps: ['将龙舌兰酒和青柠汁倒入高球杯。', '加入冰块与一小撮盐，再加入粉红西柚汽水，轻轻搅匀。', '以青柠片装饰；此配方中的盐入杯调味，不是可选盐边。'],
  }),
  recipe({
    id: 'mojito', name_zh: '莫吉托', name_en: 'Mojito',
    iba_category: 'contemporary_classics', family: 'highball', glass: 'Highball', style: 'build', difficulty: 'easy',
    taste: '薄荷的清凉与青柠的明亮，沿着气泡慢慢散开。', healing_copy: '薄荷轻轻晃，晚风就进了杯子。',
    ingredients: [line('white_rum', '45 ml'), line('lime_juice', '20 ml'), line('mint', '6 枝'), line('sugar', '2 茶匙'), line('soda_water', '补满'), line('lime_slice', '1 片', 'garnish')],
    steps: ['将薄荷、细砂糖和青柠汁在杯中轻轻混合，薄荷是风味必备材料。', '加少许苏打水，再装入冰块。', '倒入白朗姆，补上苏打水，轻轻搅匀，以青柠片和已有薄荷点缀。'],
  }),
  recipe({
    id: 'old-fashioned', name_zh: '古典', name_en: 'Old Fashioned',
    iba_category: 'unforgettables', family: 'old_fashioned', glass: 'Rocks', style: 'build', difficulty: 'easy',
    taste: '波本的橡木与香草风味，在糖和苦精中缓缓展开。', healing_copy: '有些温柔，适合慢慢搅匀。',
    ingredients: [line('bourbon', '45 ml'), line('sugar_cube', '1 块'), line('angostura', '数 dash（振）'), line('water', '数 dash（振）'), line('orange_peel', '1 片', 'garnish'), line('cocktail_cherry', '1 颗', 'garnish')],
    steps: ['此处采用 IBA 允许的波本版本。将方糖放入古典杯，滴上苦精和饮用水。', '轻压搅拌至方糖溶解，加满冰块后倒入波本。', '轻轻搅拌，以橙皮和鸡尾酒樱桃装饰。'],
  }),
  recipe({
    id: 'negroni', name_zh: '尼格罗尼', name_en: 'Negroni',
    iba_category: 'unforgettables', family: 'old_fashioned', glass: 'Rocks', style: 'build', difficulty: 'easy',
    taste: '草本、柑橘与悠长微苦，三种风味等量相拥。', healing_copy: '一点微苦，也能拥有圆润的结尾。',
    ingredients: [line('gin', '30 ml'), line('campari', '30 ml'), line('sweet_vermouth', '30 ml'), line('orange_slice', '半片', 'garnish')],
    steps: ['将金酒、金巴利和甜红味美思倒入冰镇、装有冰块的古典杯。', '轻轻搅匀，用半片橙片装饰。'],
  }),
  recipe({
    id: 'boulevardier', name_zh: '林荫大道', name_en: 'Boulevardier',
    iba_category: 'unforgettables', family: 'old_fashioned', glass: 'Coupe', style: 'stir', difficulty: 'easy',
    taste: '波本的温润酒香，衬着金巴利与味美思的微苦甘甜。', healing_copy: '沿着安静的林荫路，走回自己的节奏。',
    ingredients: [line('bourbon', '45 ml'), line('campari', '30 ml'), line('sweet_vermouth', '30 ml'), line('orange_peel', '1 片', 'garnish')],
    steps: ['此处采用 IBA 允许的波本版本。将所有必备材料倒入装有冰块的搅拌杯。', '充分搅拌，滤入冰镇鸡尾酒杯。', '以橙皮装饰。'],
  }),
  recipe({
    id: 'sazerac', name_zh: '萨泽拉克', name_en: 'Sazerac',
    iba_category: 'unforgettables', family: 'old_fashioned', glass: 'Rocks', style: 'stir', difficulty: 'medium',
    taste: '干邑与苦精的浓郁芳香，留下苦艾的草本余韵。', healing_copy: '一层草本香，替夜晚留个书签。',
    ingredients: [line('cognac', '50 ml'), line('absinthe', '10 ml，润杯'), line('sugar_cube', '1 块'), line('peychaud', '2 dash（振）'), line('lemon_peel', '1 片', 'garnish')],
    steps: ['用苦艾酒润洗冰镇古典杯，放入碎冰并暂置一旁。', '在搅拌杯中将干邑、方糖与佩肖苦精加冰搅匀。', '倒掉出品杯中的碎冰和多余苦艾酒，将混合酒液滤入，以柠檬皮装饰。'],
  }),
  recipe({
    id: 'rusty-nail', name_zh: '锈钉', name_en: 'Rusty Nail',
    iba_category: 'unforgettables', family: 'old_fashioned', glass: 'Rocks', style: 'build', difficulty: 'easy',
    taste: '苏格兰威士忌的麦香，与杜林标的蜂蜜草本融为一体。', healing_copy: '留一点安静，闻一闻杯里的麦香。',
    ingredients: [line('scotch', '45 ml'), line('drambuie', '25 ml'), line('lemon_peel', '1 片', 'garnish')],
    steps: ['将苏格兰威士忌与杜林标倒入装有冰块的古典杯。', '轻轻搅拌，以柠檬皮装饰。'],
  }),
  recipe({
    id: 'dry-martini', name_zh: '干马天尼', name_en: 'Dry Martini',
    iba_category: 'unforgettables', family: 'martini', glass: 'Martini', style: 'stir', difficulty: 'easy',
    taste: '干爽利落的金酒草本香，带少许味美思的细腻酒香。', healing_copy: '把纷扰滤去，留一杯清清亮亮。',
    ingredients: [line('gin', '60 ml'), line('dry_vermouth', '10 ml'), line('lemon_peel', '1 片', 'garnish')],
    steps: ['将金酒与干味美思倒入装有冰块的搅拌杯，充分搅拌。', '滤入冰镇马天尼杯。', '在表面挤出柠檬皮油；IBA 也允许以绿橄榄作为装饰选择。'],
  }),
  recipe({
    id: 'manhattan', name_zh: '曼哈顿', name_en: 'Manhattan',
    iba_category: 'unforgettables', family: 'martini', glass: 'Coupe', style: 'stir', difficulty: 'easy',
    taste: '黑麦辛香与甜红味美思相融，苦精令层次更悠长。', healing_copy: '城市慢慢暗下来，杯边亮着一颗樱桃。',
    ingredients: [line('rye_whiskey', '50 ml'), line('sweet_vermouth', '20 ml'), line('angostura', '1 dash（振）'), line('cocktail_cherry', '1 颗', 'garnish')],
    steps: ['将黑麦威士忌、甜红味美思和苦精倒入装有冰块的搅拌杯。', '充分搅拌，滤入冰镇鸡尾酒杯。', '以鸡尾酒樱桃装饰。'],
  }),
  recipe({
    id: 'espresso-martini', name_zh: '浓缩咖啡马天尼', name_en: 'Espresso Martini',
    iba_category: 'new_era', family: 'martini', glass: 'Martini', style: 'shake', difficulty: 'medium',
    taste: '浓缩咖啡的烘焙香与咖啡利口酒的甜润，盖上细腻泡沫。', healing_copy: '咖啡香轻轻落下，给此刻一个句点。',
    ingredients: [line('vodka', '50 ml'), line('coffee_liqueur', '30 ml'), line('simple_syrup', '10 ml'), line('espresso', '1 份浓缩'), line('coffee_beans', '3 颗', 'garnish')],
    steps: ['将伏特加、咖啡利口酒、单糖浆和浓缩咖啡倒入摇壶。', '加入冰块，用力摇和至产生细腻泡沫。', '滤入冰镇鸡尾酒杯，以 3 颗咖啡豆点缀。'],
  }),
  recipe({
    id: 'black-russian', name_zh: '黑俄罗斯', name_en: 'Black Russian',
    iba_category: 'contemporary_classics', family: 'martini', glass: 'Rocks', style: 'build', difficulty: 'easy',
    taste: '伏特加清冽直接，咖啡利口酒带来浓郁微甜。', healing_copy: '两种材料，也能把片刻照顾得很好。',
    ingredients: [line('vodka', '50 ml'), line('coffee_liqueur', '20 ml')],
    steps: ['在古典杯中放入冰块。', '倒入伏特加与咖啡利口酒，轻轻搅匀。'],
  }),
  recipe({
    id: 'hanky-panky', name_zh: '汉基潘基', name_en: 'Hanky Panky',
    iba_category: 'unforgettables', family: 'martini', glass: 'Coupe', style: 'stir', difficulty: 'easy',
    taste: '金酒与甜味美思的圆润之中，藏着菲奈特的清凉草本。', healing_copy: '小小的草本魔法，让日常多一点趣味。',
    ingredients: [line('gin', '45 ml'), line('sweet_vermouth', '45 ml'), line('fernet', '7.5 ml'), line('orange_peel', '1 片', 'garnish')],
    steps: ['将金酒、甜红味美思和菲奈特倒入装有冰块的搅拌杯。', '充分搅拌，滤入冰镇鸡尾酒杯。', '以橙皮装饰。'],
  }),
  recipe({
    id: 'sidecar', name_zh: '边车', name_en: 'Sidecar',
    iba_category: 'unforgettables', family: 'daisy', glass: 'Coupe', style: 'shake', difficulty: 'easy',
    taste: '干邑的葡萄香、橙味利口酒与柠檬酸感，轮廓鲜明。', healing_copy: '沿着柑橘香，拐进悠闲的小巷。',
    ingredients: [line('cognac', '50 ml'), line('triple_sec', '20 ml'), line('lemon_juice', '20 ml')],
    steps: ['将干邑、橙味利口酒与柠檬汁加入摇壶。', '加冰充分摇和，滤入冰镇鸡尾酒杯。'],
  }),
  recipe({
    id: 'margarita', name_zh: '玛格丽特', name_en: 'Margarita',
    iba_category: 'contemporary_classics', family: 'daisy', glass: 'Coupe', style: 'shake', difficulty: 'easy',
    taste: '龙舌兰的草木香与青柠明快相遇，橙香作柔和衬底。', healing_copy: '杯沿一点盐，衬出今天的小甜。',
    ingredients: [line('tequila', '50 ml'), line('triple_sec', '20 ml'), line('lime_juice', '15 ml'), line('salt_rim', '半圈，可选', 'garnish')],
    steps: ['按喜好为冰镇鸡尾酒杯制作半圈盐边。', '将龙舌兰酒、橙味利口酒和青柠汁加冰摇和。', '滤入冰镇杯中，盐边可省略。'],
  }),
  recipe({
    id: 'white-lady', name_zh: '白色佳人', name_en: 'White Lady',
    iba_category: 'unforgettables', family: 'daisy', glass: 'Coupe', style: 'shake', difficulty: 'easy',
    taste: '金酒的清香融入柠檬与橙味利口酒，清爽干净。', healing_copy: '一杯轻盈的柑橘香，像干净的白衬衣。',
    ingredients: [line('gin', '40 ml'), line('triple_sec', '30 ml'), line('lemon_juice', '20 ml')],
    steps: ['将金酒、橙味利口酒和柠檬汁倒入摇壶，加冰充分摇和。', '滤入冰镇鸡尾酒杯。IBA 此版本不含蛋清。'],
  }),
  recipe({
    id: 'between-the-sheets', name_zh: '床笫之间', name_en: 'Between the Sheets',
    iba_category: 'unforgettables', family: 'daisy', glass: 'Coupe', style: 'shake', difficulty: 'easy',
    taste: '白朗姆与干邑交织，柠檬和橙酒将香气串联。', healing_copy: '关掉催促的声音，给夜晚留一点柔软。',
    ingredients: [line('white_rum', '30 ml'), line('cognac', '30 ml'), line('triple_sec', '30 ml'), line('lemon_juice', '20 ml')],
    steps: ['将白朗姆、干邑、橙味利口酒和柠檬汁一起倒入摇壶。', '加冰充分摇和，滤入冰镇鸡尾酒杯。两种基酒均为必备。'],
  }),
  recipe({
    id: 'cosmopolitan', name_zh: '大都会', name_en: 'Cosmopolitan',
    iba_category: 'contemporary_classics', family: 'daisy', glass: 'Martini', style: 'shake', difficulty: 'easy',
    taste: '蔓越莓的轻盈酸甜，与柠檬伏特加和橙香相拥。', healing_copy: '把晚霞装进杯子，把自己放回此刻。',
    ingredients: [line('citron_vodka', '40 ml'), line('triple_sec', '15 ml'), line('lime_juice', '15 ml'), line('cranberry_juice', '30 ml'), line('lemon_peel', '1 卷', 'garnish')],
    steps: ['将柠檬风味伏特加、橙味利口酒、青柠汁和蔓越莓汁放入装有冰块的摇壶。', '充分摇和，滤入冰镇的大号鸡尾酒杯。', '以柠檬皮卷装饰。'],
  }),
  recipe({
    id: 'tommys-margarita', name_zh: '汤米玛格丽特', name_en: 'Tommy’s Margarita',
    iba_category: 'new_era', family: 'sour', glass: 'Rocks', style: 'shake', difficulty: 'easy',
    taste: '龙舌兰酒与龙舌兰蜜相伴，青柠让风味更加明亮。', healing_copy: '三种材料，留住一个清楚的此刻。',
    ingredients: [line('tequila', '60 ml'), line('lime_juice', '30 ml'), line('agave_nectar', '30 ml'), line('lime_slice', '1 片', 'garnish')],
    steps: ['将龙舌兰酒、青柠汁和龙舌兰糖浆加冰充分摇和。', '滤入冰镇、装有冰块的古典杯，以青柠片装饰。'],
  }),
  recipe({
    id: 'spritz', name_zh: '阿佩罗斯普利茨', name_en: 'Spritz',
    iba_category: 'new_era', family: 'highball', glass: 'Wine Glass', style: 'build', difficulty: 'easy',
    taste: '橙香微苦的阿佩罗，与普罗塞克气泡清爽相伴。', healing_copy: '橙色的气泡，是猫咪留给黄昏的注脚。',
    ingredients: [line('prosecco', '90 ml'), line('aperol', '60 ml'), line('soda_water', '少许'), line('orange_slice', '1 片', 'garnish')],
    steps: ['将普罗塞克、阿佩罗与苏打水倒入装有冰块的葡萄酒杯。', '轻轻搅匀，以橙片装饰。'],
  }),
  recipe({
    id: 'bellini', name_zh: '贝利尼', name_en: 'Bellini',
    iba_category: 'contemporary_classics', family: 'other', glass: 'Flute', style: 'stir', difficulty: 'easy',
    taste: '细腻白桃果泥与普罗塞克气泡，果香柔和清新。', healing_copy: '白桃的软香，像傍晚轻轻落下的光。',
    ingredients: [line('prosecco', '100 ml'), line('peach_puree', '50 ml')],
    steps: ['将白桃果泥放入装有冰块的搅拌杯，加入普罗塞克。', '轻轻搅拌，倒入冰镇香槟笛形杯。'],
  }),
  recipe({
    id: 'mimosa', name_zh: '含羞草', name_en: 'Mimosa',
    iba_category: 'contemporary_classics', family: 'fizz', glass: 'Flute', style: 'build', difficulty: 'easy',
    taste: '鲜橙的明亮果香，与起泡酒的轻盈气泡相映。', healing_copy: '一杯柔和橙光，把时钟拨慢一点。',
    ingredients: [line('orange_juice', '75 ml'), line('prosecco', '75 ml'), line('orange_peel', '1 卷，可选', 'garnish')],
    steps: ['先将鲜榨橙汁倒入香槟笛形杯，再缓慢倒入普罗塞克。', '轻轻搅拌，可用橙皮卷装饰。'],
  }),
  recipe({
    id: 'pina-colada', name_zh: '椰林飘香', name_en: 'Piña Colada',
    iba_category: 'contemporary_classics', family: 'other', glass: 'Hurricane', style: 'blend', difficulty: 'easy',
    taste: '菠萝的酸甜与椰浆的浓郁，调成柔滑的热带果香。', healing_copy: '让菠萝和椰香，替心情撑一把小伞。',
    ingredients: [line('white_rum', '50 ml'), line('coconut_cream', '30 ml'), line('pineapple_juice', '50 ml'), line('pineapple_slice', '1 片', 'garnish'), line('cocktail_cherry', '1 颗', 'garnish')],
    steps: ['将白朗姆、椰浆、菠萝汁与冰块放入电动搅拌机。', '搅打均匀后倒入大杯，以菠萝片和鸡尾酒樱桃装饰。'],
  }),
  recipe({
    id: 'planters-punch', name_zh: '种植园宾治', name_en: 'Planter’s Punch',
    iba_category: 'unforgettables', family: 'sour', glass: 'Tumbler', style: 'build', difficulty: 'easy',
    taste: '牙买加朗姆的果香，与甘蔗汁和青柠融合成清晰酸甜。', healing_copy: '把热带的晚风，留在一小杯里。',
    ingredients: [line('jamaican_rum', '45 ml'), line('lime_juice', '15 ml'), line('sugarcane_juice', '30 ml'), line('orange_peel', '1 片', 'garnish')],
    steps: ['将牙买加朗姆、青柠汁和甘蔗汁直接倒入小平底杯或陶杯。', '按口味用冰块或饮用水适量稀释，轻轻搅匀，以橙皮装饰。'],
  }),
  recipe({
    id: 'americano', name_zh: '美国佬', name_en: 'Americano',
    iba_category: 'unforgettables', family: 'highball', glass: 'Rocks', style: 'build', difficulty: 'easy',
    taste: '金巴利与味美思的草本苦甜，因苏打而轻盈。', healing_copy: '一声轻轻的气泡响，是此刻的背景音。',
    ingredients: [line('campari', '30 ml'), line('sweet_vermouth', '30 ml'), line('soda_water', '少许'), line('orange_slice', '半片', 'garnish'), line('lemon_peel', '1 片', 'garnish')],
    steps: ['将金巴利与甜红味美思倒入装有冰块的古典杯。', '加入少许苏打水并轻轻搅匀。', '以半片橙片和柠檬皮装饰。'],
  }),
  recipe({
    id: 'aviation', name_zh: '航空', name_en: 'Aviation',
    iba_category: 'unforgettables', family: 'daisy', glass: 'Coupe', style: 'shake', difficulty: 'easy',
    taste: '金酒与柠檬的清爽中，浮着黑樱桃和紫罗兰的花果香。', healing_copy: '借一缕紫罗兰香，让思绪轻轻飞一会。',
    ingredients: [line('gin', '45 ml'), line('maraschino', '15 ml'), line('lemon_juice', '15 ml'), line('violet_liqueur', '1 吧勺'), line('cocktail_cherry', '1 颗，可选', 'garnish')],
    steps: ['将金酒、黑樱桃利口酒、柠檬汁与紫罗兰利口酒倒入摇壶。', '加入碎冰摇和，滤入冰镇鸡尾酒杯。', '可用鸡尾酒樱桃装饰。'],
  }),
];
