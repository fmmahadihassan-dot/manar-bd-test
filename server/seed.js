/* স্বয়ংক্রিয়ভাবে তৈরি: প্রথমবার ডাটাবেস খালি থাকলে এই পণ্যগুলো ঢোকে। পরে সব কিছু অ্যাডমিন প্যানেল থেকে বদলাবেন। */
export const SEED_PRODUCTS = [
 {
  "id": "ss-kettle",
  "name": "Stainless Steel Electric Kettle",
  "short": "Durable body, auto shut-off",
  "brand": "Manar BD",
  "price": 1150,
  "old": 1450,
  "free": false,
  "charge": 80,
  "badge": "Bestseller",
  "hot": true,
  "popular": true,
  "tags": [
   "kitchen",
   "electronics",
   "appliance"
  ],
  "img": "images/products/ss-kettle.jpg",
  "imgSm": "images/products/ss-kettle-sm.jpg",
  "gallery": [
   "images/products/ss-kettle.jpg"
  ],
  "about": "A tough stainless steel kettle for quick hot water at home, in the office or in the kitchen.",
  "features": [
   "High quality stainless steel body",
   "Dual safety protection system",
   "Hot water in a short time",
   "Perfect for home, office and kitchen"
  ],
  "specs": [
   [
    "Material",
    "Stainless steel"
   ]
  ]
 },
 {
  "id": "glass-kettle-1",
  "name": "LED Glass Electric Kettle",
  "short": "Blue LED glow, clear glass body",
  "brand": "Manar BD",
  "price": 1450,
  "old": 1850,
  "free": true,
  "hot": true,
  "tags": [
   "kitchen",
   "electronics",
   "appliance"
  ],
  "img": "images/products/glass-kettle-1.jpg",
  "imgSm": "images/products/glass-kettle-1-sm.jpg",
  "gallery": [
   "images/products/glass-kettle-1.jpg"
  ],
  "about": "See the water boil through a clear glass body lit by a blue LED glow.",
  "features": [
   "Clear high-borosilicate glass body",
   "Blue LED light glows while boiling",
   "Dual safety protection system",
   "Perfect for home, office and kitchen"
  ],
  "specs": [
   [
    "Material",
    "Glass body"
   ]
  ]
 },
 {
  "id": "glass-kettle-2",
  "name": "Premium Glass Kettle",
  "short": "Beige base, 1-year warranty",
  "brand": "Manar BD",
  "price": 1650,
  "old": 2100,
  "free": false,
  "charge": 80,
  "badge": "Popular",
  "popular": true,
  "tags": [
   "kitchen",
   "electronics",
   "appliance"
  ],
  "img": "images/products/glass-kettle-2.jpg",
  "imgSm": "images/products/glass-kettle-2-sm.jpg",
  "gallery": [
   "images/products/glass-kettle-2.jpg"
  ],
  "about": "An elegant glass kettle with a beige base, backed by a one-year warranty.",
  "features": [
   "1 year warranty",
   "Elegant beige base and clear glass",
   "Dual safety protection system",
   "Perfect for home, office and kitchen"
  ],
  "specs": [
   [
    "Warranty",
    "1 year"
   ]
  ]
 },
 {
  "id": "nail-set",
  "name": "Premium Nail Care Set (10 pcs)",
  "short": "Stainless steel, pink case",
  "brand": "Manar BD",
  "price": 650,
  "old": 850,
  "free": false,
  "charge": 60,
  "popular": true,
  "tags": [
   "personal"
  ],
  "img": "images/products/nail-set.jpg",
  "imgSm": "images/products/nail-set-sm.jpg",
  "gallery": [
   "images/products/nail-set.jpg"
  ],
  "about": "A complete manicure and pedicure kit in a neat pink travel case.",
  "features": [
   "Complete 10-piece set",
   "Sharp, durable high-carbon steel",
   "Neat leather-style case, easy to carry",
   "For home or travel"
  ],
  "specs": [
   [
    "Pieces",
    "10"
   ],
   [
    "Material",
    "Stainless steel"
   ]
  ]
 },
 {
  "id": "extension-board",
  "name": "Overload Protection Extension Board",
  "short": "2200W, 10A",
  "brand": "Manar BD",
  "price": 520,
  "old": 650,
  "free": false,
  "charge": 70,
  "badge": "Safe",
  "popular": true,
  "variants": [
   {
    "name": "3 Socket",
    "price": 520,
    "old": 650
   },
   {
    "name": "4 Socket",
    "price": 620,
    "old": 780
   },
   {
    "name": "5 Socket",
    "price": 720,
    "old": 900
   }
  ],
  "tags": [
   "electrical",
   "socket"
  ],
  "img": "images/products/extension-board.jpg",
  "imgSm": "images/products/extension-board-sm.jpg",
  "gallery": [
   "images/products/extension-board.jpg"
  ],
  "about": "A multi-socket extension board with overload protection for safe, everyday use.",
  "features": [
   "Multi socket for several devices at once",
   "Safe design with overload protection",
   "Max 2200 watt, 10 ampere",
   "Perfect for home and office"
  ],
  "specs": [
   [
    "Max power",
    "2200 W"
   ],
   [
    "Max current",
    "10 A"
   ]
  ]
 },
 {
  "id": "led-bulb",
  "name": "LED Bulb Set (3 pcs)",
  "short": "Low power use, bright light",
  "brand": "Manar BD",
  "price": 390,
  "old": 520,
  "free": true,
  "hot": true,
  "tags": [
   "electrical",
   "light"
  ],
  "icon": "bulb",
  "about": "Bright LED bulbs that use less electricity.",
  "features": [
   "Bright light, low power use",
   "Long lasting",
   "Great for homes and shops"
  ]
 },
 {
  "id": "wall-clock",
  "name": "Digital Wall Clock",
  "short": "With date and temperature",
  "brand": "Manar BD",
  "price": 890,
  "old": 1200,
  "free": false,
  "charge": 70,
  "tags": [
   "decor",
   "home"
  ],
  "icon": "clock",
  "about": "A modern digital clock for your wall.",
  "features": [
   "Large, clear display",
   "Modern home decor design",
   "Easy to hang on the wall"
  ]
 },
 {
  "id": "hair-dryer",
  "name": "Hair Dryer",
  "short": "Fast drying, lightweight",
  "brand": "Manar BD",
  "price": 1350,
  "old": 1790,
  "free": false,
  "charge": 90,
  "tags": [
   "personal",
   "electronics",
   "appliance"
  ],
  "icon": "dryer",
  "about": "A lightweight dryer for quick styling.",
  "features": [
   "Hot and cool air",
   "Light and easy to hold",
   "Good for home and travel"
  ]
 },
 {
  "id": "trimmer",
  "name": "Rechargeable Electric Trimmer",
  "short": "For beard and hair",
  "brand": "Manar BD",
  "price": 950,
  "old": 1250,
  "free": true,
  "hot": true,
  "tags": [
   "personal",
   "electronics",
   "gadget"
  ],
  "icon": "trimmer",
  "about": "Groom at home with a rechargeable trimmer.",
  "features": [
   "Rechargeable battery",
   "Sharp stainless steel blade",
   "Easy grooming at home"
  ]
 },
 {
  "id": "bath-shelf",
  "name": "Bathroom Organizer Shelf",
  "short": "Wall mounted, rust resistant",
  "brand": "Manar BD",
  "price": 720,
  "old": 950,
  "free": false,
  "charge": 70,
  "tags": [
   "bathroom",
   "home"
  ],
  "icon": "shelf",
  "about": "Keep shampoo, soap and toiletries organised.",
  "features": [
   "No drilling required",
   "Rust resistant material",
   "Keeps toiletries tidy"
  ]
 },
 {
  "id": "shower-head",
  "name": "High-Pressure Shower Head",
  "short": "Strong flow, less water",
  "brand": "Manar BD",
  "price": 480,
  "old": 650,
  "free": true,
  "hot": true,
  "tags": [
   "bathroom"
  ],
  "icon": "shower",
  "about": "A shower head that boosts water pressure.",
  "features": [
   "Boosts water pressure",
   "Easy to install and remove",
   "Easy to clean"
  ]
 },
 {
  "id": "mini-blender",
  "name": "Mini Blender",
  "short": "For juice and smoothies",
  "brand": "Manar BD",
  "price": 1250,
  "old": 1600,
  "free": false,
  "charge": 90,
  "tags": [
   "kitchen",
   "electronics",
   "appliance"
  ],
  "icon": "blender",
  "about": "A compact blender for juice and smoothies.",
  "features": [
   "Compact, saves space",
   "Sharp stainless steel blades",
   "Easy to clean"
  ]
 },
 {
  "id": "bt-speaker",
  "name": "Bluetooth Speaker",
  "short": "Portable, clear sound",
  "brand": "Manar BD",
  "price": 1490,
  "old": 1990,
  "free": false,
  "charge": 70,
  "tags": [
   "electronics",
   "gadget"
  ],
  "icon": "speaker",
  "about": "A portable wireless speaker.",
  "features": [
   "Wireless Bluetooth connection",
   "Small enough to carry",
   "Use it at home or outdoors"
  ]
 },
 {
  "id": "mosquito-bat",
  "name": "Rechargeable Mosquito Killer Bat",
  "short": "LED torch, USB charging",
  "brand": "Manar BD",
  "price": 690,
  "old": 890,
  "free": false,
  "charge": 70,
  "hot": true,
  "tags": [
   "electrical",
   "personal",
   "gadget"
  ],
  "icon": "zap",
  "model": "MB-1000",
  "type": "Mosquito Racket",
  "warranty": "6 months",
  "battery": "1000 mAh",
  "light": "LED torch",
  "chargingTime": "5-6 hours",
  "usageTime": "8-10 hours",
  "eco": true,
  "voltage": "3.7 V (rechargeable)",
  "about": "A rechargeable mosquito killer bat with a built-in LED torch.",
  "features": [
   "Built-in LED torch",
   "Safe protective mesh",
   "Rechargeable, no batteries to buy"
  ]
 },
 {
  "id": "sponge-rack",
  "name": "Kitchen Sponge Rack",
  "short": "Sink side, keeps sponges dry",
  "brand": "Manar BD",
  "price": 320,
  "old": 420,
  "free": true,
  "tags": [
   "kitchen",
   "home"
  ],
  "icon": "shelf",
  "material": "Stainless steel",
  "about": "A sink-side rack that keeps sponges and brushes dry and tidy.",
  "features": [
   "Drains water away",
   "Rust resistant",
   "Saves counter space"
  ]
 },
 {
  "id": "fast-charger",
  "name": "Fast Charger 20W",
  "short": "Quick charging adapter",
  "brand": "Manar BD",
  "price": 590,
  "old": 790,
  "free": true,
  "hot": true,
  "tags": [
   "electronics",
   "gadget"
  ],
  "icon": "charger",
  "about": "A compact 20 watt fast charging adapter.",
  "features": [
   "20 watt fast charging",
   "Overheat protection",
   "Small and portable"
  ]
 }
];
export const SEED_SETTINGS = {
 "hero": [
  {
   "img": "images/hero/banner-1.jpg",
   "product": "glass-kettle-1",
   "alt": "LED glass electric kettle"
  },
  {
   "img": "images/hero/banner-2.jpg",
   "product": "nail-set",
   "alt": "Premium nail care set"
  },
  {
   "img": "images/hero/banner-3.jpg",
   "product": "extension-board",
   "alt": "Overload protection extension board"
  },
  {
   "img": "images/hero/banner-4.jpg",
   "product": "ss-kettle",
   "alt": "Stainless steel electric kettle"
  }
 ],
 "offer": {
  "enabled": false,
  "minOrder": 999,
  "text": "Special offer: free delivery on orders of ৳999 or more!",
  "startDate": "",
  "endDate": ""
 },
 "promo": {
  "code": "MANAR10",
  "percent": 10
 }
};
