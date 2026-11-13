/* =====================================================================
   MANAR BD – স্টোরের সব ডেটা এই ফাইলে (ওয়েবসাইটের লেখা ইংরেজিতে)।
   নতুন প্রোডাক্ট যোগ করতে products অ্যারেতে একটি অবজেক্ট কপি করে বদলান।
   ===================================================================== */
window.STORE = {
  name: 'Manar BD',
  currency: '৳',                       // মুদ্রার চিহ্ন (চাইলে 'Tk' দিন)
  whatsapp: '8801337885511',           // হোয়াটসঅ্যাপ নম্বর (দেশ কোডসহ, + ছাড়া)
  phoneDisplay: '01337-885511',
  email: 'manarbdteam@outlook.com',                           // সাপোর্ট ইমেইল (ঐচ্ছিক, দিলে Contact পপ-আপে দেখাবে)
  address: 'Dhaka, Bangladesh',        // দোকানের ঠিকানা (ফুটার ও Contact পেজে দেখায়) — নিজের ঠিকানা বসান
  hours: 'Every day, 10 AM – 10 PM',  // খোলা থাকার সময়
  about: 'Manar BD brings everyday electrical, electronics, home and kitchen, personal care and bathroom products to your door across Bangladesh. Pay cash on delivery and chat with us on WhatsApp any time.',
  /* ফুটারের সোশ্যাল লিংক: নিজের পেজের লিংক বসান, ফাঁকা রাখলে আইকন লুকিয়ে যাবে (WhatsApp নিজে থেকেই আসে) */
  social: { facebook: 'https://facebook.com/', instagram: 'https://instagram.com/', messenger: 'https://m.me/', youtube: 'https://youtube.com/' },
  /* অর্ডার ইমেইলে পাঠাতে: web3forms.com এ আপনার ইমেইল দিয়ে Access Key নিয়ে এখানে বসান */
  web3formsKey: '',          // অর্ডারের ইমেইল আসার জন্য (Web3Forms)
  /* ---------------------------------------------------------------
     হিরো ব্যানারের নিচের রিওয়ার্ড কার্ড ("Buy 5 get 200 TK discount")
       enabled: false দিলে কার্ডটা দেখাবে না
       orders = কয়টা অর্ডার সম্পূর্ণ করলে রিওয়ার্ড, reward = ছাড়ের টাকা
       min / max = পরবর্তী কেনাকাটার দামের সীমা (টাকায়)
     লগইন করা কাস্টমারের সম্পন্ন অর্ডারের সংখ্যা অনুযায়ী গোল ঘরগুলো ভরে (শুধু ডাইনামিক ভার্সনে)।
     --------------------------------------------------------------- */
  loyalty: { enabled: true, orders: 5, reward: 200, min: 500, max: 1000 },

  /* ---------------------------------------------------------------
     ফ্রি ডেলিভারি অফার: enabled: true দিলে চালু, false দিলে বন্ধ (কোড থেকে যায়)।
       minOrder  = এই টাকা বা তার বেশি পণ্যের দামে ডেলিভারি ফ্রি
       text      = পেজের একদম ওপরের চলমান লেখা (ডান থেকে বামে যায়)
       startDate / endDate = ঐচ্ছিক, 'YYYY-MM-DD' ফরম্যাটে (দুই তারিখসহ)। ফাঁকা রাখলে তারিখের সীমা নেই
     --------------------------------------------------------------- */
  offer: {
    enabled: true,
    minOrder: 999,
    text: 'Special offer: free delivery on orders of ৳999 or more!',
    startDate: '',
    endDate: ''
  },
  promo: { code: 'MANAR5', percent: 10 },   // ডাইনামিক ভার্সনে প্রোমো কোড গোপন থাকে: অ্যাডমিন প্যানেলের Offers ট্যাব থেকে বদলান

  /* ---------------------------------------------------------------
     হিরো ব্যানার: শুধু আপনার ডিজাইন করা ছবি, কোনো লেখা যোগ হয় না।
       img       = ব্যানারের ছবি। মোবাইল ও ডেস্কটপ দুই জায়গাতেই একই ছবি দেখায়।
                   সাইজ ইউটিউব থাম্বনেইলের মতো 16:9 রাখুন, প্রস্তাবিত 1920 x 1080 px (কমপক্ষে 1280 x 720 px)
       product   = ছবিতে ক্লিক করলে যে প্রোডাক্টের পেজ খুলবে তার id
       alt       = ছবির বিবরণ (স্ক্রিন রিডারের জন্য)
     নিচের ছবিগুলো নমুনা। নিজের ছবি images/hero/ ফোল্ডারে রেখে পাথ বদলান।
     --------------------------------------------------------------- */
  hero: [
    { img: 'images/hero/banner-1.jpg', product: 'glass-kettle-1', alt: 'LED glass electric kettle' },
    { img: 'images/hero/banner-2.jpg', product: 'nail-set', alt: 'Premium nail care set' },
    { img: 'images/hero/banner-3.jpg', product: 'extension-board', alt: 'Overload protection extension board' },
    { img: 'images/hero/banner-4.jpg', product: 'ss-kettle', alt: 'Stainless steel electric kettle' }
  ],


  /* ক্যাটাগরি চিপ */
  categories: [
    { tag: 'all', label: 'All', icon: 'grid' },
    { tag: 'electrical', label: 'Electrical', icon: 'zap' },
    { tag: 'electronics', label: 'Electronics', icon: 'monitor' },
    { tag: 'decor', label: 'Home Decor', icon: 'sofa' },
    { tag: 'kitchen', label: 'Kitchen', icon: 'kitchen' },
    { tag: 'personal', label: 'Personal Care', icon: 'personal' },
    { tag: 'bathroom', label: 'Bathroom', icon: 'drop' },
    { tag: 'gadget', label: 'Gadgets', icon: 'phone' }
  ],
  tagNames: { electrical: 'Electrical', socket: 'Sockets & Boards', light: 'Lights & Bulbs', electronics: 'Electronics', appliance: 'Appliances', gadget: 'Gadgets', home: 'Home', decor: 'Home Decor', kitchen: 'Kitchen', bathroom: 'Bathroom', personal: 'Personal Care' },

  /* সাইড মেনু (অ্যারোতে ক্লিক করলে সাব মেনু খুলবে) */
  menu: [
    { label: 'Home', icon: 'home', action: 'home', sub: [
      { label: 'Home Decor', tag: 'decor' }, { label: 'Kitchen', tag: 'kitchen' }, { label: 'Bathroom', tag: 'bathroom' } ] },
    { label: 'Electrical', icon: 'zap', tag: 'electrical', sub: [
      { label: 'Sockets & Boards', tag: 'socket' }, { label: 'Lights & Bulbs', tag: 'light' } ] },
    { label: 'Electronics', icon: 'monitor', tag: 'electronics', sub: [
      { label: 'Appliances', tag: 'appliance' }, { label: 'Gadgets', tag: 'gadget' } ] },
    { label: 'Personal Care', icon: 'personal', tag: 'personal' },
    { label: 'Offers & Hot Deals', icon: 'tag', action: 'deals' },
    { label: 'All Products', icon: 'grid', action: 'all' },
    { label: 'My Orders', icon: 'receipt', action: 'orders' }
  ],

  /* ---------------------------------------------------------------
     প্রোডাক্ট।
       free: true = ফ্রি ডেলিভারি, না হলে charge = ডেলিভারি চার্জ
       brand   = ব্র্যান্ডের নাম
       inStock = true হলে স্টকে আছে, false হলে স্টকে নেই (না লিখলে true ধরা হয়)। স্টক না থাকলে Add to Cart / Buy Now বন্ধ
       তথ্য ফিল্ড (যেটা লিখবেন শুধু সেটাই দেখাবে, ফাঁকা বা না দিলে দেখাবে না):
         model, type (যেমন 'Electric Kettle'), warranty ('12 months'), capacity ('1.8 L'), watt ('1500 W'),
         voltage ('220-240 V'), material ('Stainless steel'), autoOff (true/false), battery ('1000 mAh'),
         light ('LED torch'), chargingTime ('6 hours'), usageTime ('8 hours'), eco (true/false)
         আরও চাইলে specs: [['নাম', 'মান'], ...]
       gallery = একাধিক ছবির তালিকা (সামনে, পেছনে, পাশ ইত্যাদি, যত খুশি)
       video   = ঐচ্ছিক। YouTube লিংক (https://youtu.be/xxxx) অথবা নিজের ফাইল ('images/videos/kettle.mp4')
       videoPoster = ভিডিওর থাম্বনেইল ছবি (ঐচ্ছিক)
       about   = ছোট বর্ণনা, features = পয়েন্ট, specs = [['নাম','মান'], ...]
     দাম ও বর্ণনা নমুনা, নিজের তথ্য বসিয়ে নিন। icon থাকলে ছবির বদলে আইকন দেখায়।
     --------------------------------------------------------------- */
  products: [
    { id: 'ss-kettle', name: 'Stainless Steel Electric Kettle', short: 'Durable body, auto shut-off', brand: 'Manar BD',
      price: 1150, old: 1450, free: false, charge: 80, badge: 'Bestseller', hot: true, popular: true,
      tags: ['kitchen', 'electronics', 'appliance'],
      img: 'images/products/ss-kettle.jpg', imgSm: 'images/products/ss-kettle-sm.jpg', gallery: ['images/products/ss-kettle.jpg'],
      about: 'A tough stainless steel kettle for quick hot water at home, in the office or in the kitchen.',
      features: ['High quality stainless steel body', 'Dual safety protection system', 'Hot water in a short time', 'Perfect for home, office and kitchen'],
      specs: [['Material', 'Stainless steel']] },
    { id: 'glass-kettle-1', name: 'LED Glass Electric Kettle', short: 'Blue LED glow, clear glass body', brand: 'Manar BD',
      price: 1450, old: 1850, free: true, hot: true,
      tags: ['kitchen', 'electronics', 'appliance'],
      img: 'images/products/glass-kettle-1.jpg', imgSm: 'images/products/glass-kettle-1-sm.jpg', gallery: ['images/products/glass-kettle-1.jpg'],
      about: 'See the water boil through a clear glass body lit by a blue LED glow.',
      features: ['Clear high-borosilicate glass body', 'Blue LED light glows while boiling', 'Dual safety protection system', 'Perfect for home, office and kitchen'],
      specs: [['Material', 'Glass body']] },
    { id: 'glass-kettle-2', name: 'Premium Glass Kettle', short: 'Beige base, 1-year warranty', brand: 'Manar BD',
      price: 1650, old: 2100, free: false, charge: 80, badge: 'Popular', popular: true,
      tags: ['kitchen', 'electronics', 'appliance'],
      img: 'images/products/glass-kettle-2.jpg', imgSm: 'images/products/glass-kettle-2-sm.jpg', gallery: ['images/products/glass-kettle-2.jpg'],
      about: 'An elegant glass kettle with a beige base, backed by a one-year warranty.',
      features: ['1 year warranty', 'Elegant beige base and clear glass', 'Dual safety protection system', 'Perfect for home, office and kitchen'],
      specs: [['Warranty', '1 year']] },
    { id: 'nail-set', name: 'Premium Nail Care Set (10 pcs)', short: 'Stainless steel, pink case', brand: 'Manar BD',
      price: 650, old: 850, free: false, charge: 60, popular: true,
      tags: ['personal'],
      img: 'images/products/nail-set.jpg', imgSm: 'images/products/nail-set-sm.jpg', gallery: ['images/products/nail-set.jpg'],
      about: 'A complete manicure and pedicure kit in a neat pink travel case.',
      features: ['Complete 10-piece set', 'Sharp, durable high-carbon steel', 'Neat leather-style case, easy to carry', 'For home or travel'],
      specs: [['Pieces', '10'], ['Material', 'Stainless steel']] },
    { id: 'extension-board', name: 'Overload Protection Extension Board', short: '2200W, 10A', brand: 'Manar BD',
      price: 520, old: 650, free: false, charge: 70, badge: 'Safe', popular: true,
      variants: [ { name: '3 Socket', price: 520, old: 650 }, { name: '4 Socket', price: 620, old: 780 }, { name: '5 Socket', price: 720, old: 900 } ],
      tags: ['electrical', 'socket'],
      img: 'images/products/extension-board.jpg', imgSm: 'images/products/extension-board-sm.jpg', gallery: ['images/products/extension-board.jpg'],
      about: 'A multi-socket extension board with overload protection for safe, everyday use.',
      features: ['Multi socket for several devices at once', 'Safe design with overload protection', 'Max 2200 watt, 10 ampere', 'Perfect for home and office'],
      specs: [['Max power', '2200 W'], ['Max current', '10 A']] },

    /* ---- নিচের প্রোডাক্টগুলো ডেমো (আইকনসহ)। নিজের ছবি ও দাম দিয়ে বদলে নিন ---- */
    { id: 'led-bulb', name: 'LED Bulb Set (3 pcs)', short: 'Low power use, bright light', brand: 'Manar BD',
      price: 390, old: 520, free: true, hot: true, tags: ['electrical', 'light'], icon: 'bulb',
      about: 'Bright LED bulbs that use less electricity.', features: ['Bright light, low power use', 'Long lasting', 'Great for homes and shops'] },
    { id: 'wall-clock', name: 'Digital Wall Clock', short: 'With date and temperature', brand: 'Manar BD',
      price: 890, old: 1200, free: false, charge: 70, tags: ['decor', 'home'], icon: 'clock',
      about: 'A modern digital clock for your wall.', features: ['Large, clear display', 'Modern home decor design', 'Easy to hang on the wall'] },
    { id: 'hair-dryer', name: 'Hair Dryer', short: 'Fast drying, lightweight', brand: 'Manar BD',
      price: 1350, old: 1790, free: false, charge: 90, tags: ['personal', 'electronics', 'appliance'], icon: 'dryer',
      about: 'A lightweight dryer for quick styling.', features: ['Hot and cool air', 'Light and easy to hold', 'Good for home and travel'] },
    { id: 'trimmer', name: 'Rechargeable Electric Trimmer', short: 'For beard and hair', brand: 'Manar BD',
      price: 950, old: 1250, free: true, hot: true, tags: ['personal', 'electronics', 'gadget'], icon: 'trimmer',
      about: 'Groom at home with a rechargeable trimmer.', features: ['Rechargeable battery', 'Sharp stainless steel blade', 'Easy grooming at home'] },
    { id: 'bath-shelf', name: 'Bathroom Organizer Shelf', short: 'Wall mounted, rust resistant', brand: 'Manar BD',
      price: 720, old: 950, free: false, charge: 70, tags: ['bathroom', 'home'], icon: 'shelf',
      about: 'Keep shampoo, soap and toiletries organised.', features: ['No drilling required', 'Rust resistant material', 'Keeps toiletries tidy'] },
    { id: 'shower-head', name: 'High-Pressure Shower Head', short: 'Strong flow, less water', brand: 'Manar BD',
      price: 480, old: 650, free: true, hot: true, tags: ['bathroom'], icon: 'shower',
      about: 'A shower head that boosts water pressure.', features: ['Boosts water pressure', 'Easy to install and remove', 'Easy to clean'] },
    { id: 'mini-blender', name: 'Mini Blender', short: 'For juice and smoothies', brand: 'Manar BD',
      price: 1250, old: 1600, free: false, charge: 90, tags: ['kitchen', 'electronics', 'appliance'], icon: 'blender',
      about: 'A compact blender for juice and smoothies.', features: ['Compact, saves space', 'Sharp stainless steel blades', 'Easy to clean'] },
    { id: 'bt-speaker', name: 'Bluetooth Speaker', short: 'Portable, clear sound', brand: 'Manar BD',
      price: 1490, old: 1990, free: false, charge: 70, tags: ['electronics', 'gadget'], icon: 'speaker',
      about: 'A portable wireless speaker.', features: ['Wireless Bluetooth connection', 'Small enough to carry', 'Use it at home or outdoors'] },
    { id: 'mosquito-bat', name: 'Rechargeable Mosquito Killer Bat', short: 'LED torch, USB charging', brand: 'Manar BD',
      price: 690, old: 890, free: false, charge: 70, hot: true, tags: ['electrical', 'personal', 'gadget'], icon: 'zap',
      model: 'MB-1000', type: 'Mosquito Racket', warranty: '6 months', battery: '1000 mAh', light: 'LED torch', chargingTime: '5-6 hours', usageTime: '8-10 hours', eco: true, voltage: '3.7 V (rechargeable)',
      about: 'A rechargeable mosquito killer bat with a built-in LED torch.', features: ['Built-in LED torch', 'Safe protective mesh', 'Rechargeable, no batteries to buy'] },
    { id: 'sponge-rack', name: 'Kitchen Sponge Rack', short: 'Sink side, keeps sponges dry', brand: 'Manar BD',
      price: 320, old: 420, free: true, tags: ['kitchen', 'home'], icon: 'shelf', material: 'Stainless steel',
      about: 'A sink-side rack that keeps sponges and brushes dry and tidy.', features: ['Drains water away', 'Rust resistant', 'Saves counter space'] },
    { id: 'fast-charger', name: 'Fast Charger 20W', short: 'Quick charging adapter', brand: 'Manar BD',
      price: 590, old: 790, free: true, hot: true, tags: ['electronics', 'gadget'], icon: 'charger',
      about: 'A compact 20 watt fast charging adapter.', features: ['20 watt fast charging', 'Overheat protection', 'Small and portable'] }
  ]
};
