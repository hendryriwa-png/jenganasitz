-- ============================================================
-- JengaNasi launch catalogue
-- Idempotent: vendors are matched by email and products by
-- (vendor_email, name), so re-running does not duplicate rows.
-- ============================================================

insert into public.vendors (
  email, name, store_name, phone, region, photo, vendor_type, verified, suspended, role, joined_at
)
select
  d.email, d.store_name, d.store_name, d.phone, d.region, d.photo, d.vendor_type, true, false, 'vendor', d.joined_at
from (values
  ('orders@kilimanjarobuilders.co.tz', 'Kilimanjaro Builders Supply', '+255 754 118 220', 'Arusha',
   'https://images.unsplash.com/photo-1773394089934-3e29f2a3d6a9?auto=format&fit=crop&w=600&q=75', 'wholesale', timestamptz '2025-11-12 08:30:00+00'),
  ('sales@mzanihardware.co.tz', 'Mzani Hardware & Cement', '+255 755 904 310', 'Mwanza',
   'https://images.unsplash.com/photo-1426927308491-6380b6a9936f?auto=format&fit=crop&w=600&q=75', 'retail', timestamptz '2025-12-03 09:15:00+00'),
  ('info@darbuildingcentre.co.tz', 'Dar Building Centre', '+255 762 447 190', 'Dar es Salaam',
   'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=75', 'company', timestamptz '2025-10-21 07:45:00+00'),
  ('sales@serengetisteel.co.tz', 'Serengeti Steel Works', '+255 767 330 845', 'Arusha',
   'https://images.unsplash.com/photo-1623428454598-1bfe414bac03?auto=format&fit=crop&w=600&q=75', 'manufacturing', timestamptz '2025-09-18 10:00:00+00'),
  ('hello@coastaltile.co.tz', 'Coastal Tile Gallery', '+255 713 882 604', 'Dar es Salaam',
   'https://images.unsplash.com/photo-1523350165414-082d792c4bcc?auto=format&fit=crop&w=600&q=75', 'retail', timestamptz '2025-12-15 11:20:00+00'),
  ('orders@highlandroofing.co.tz', 'Highland Roofing Co.', '+255 759 201 776', 'Mbeya',
   'https://images.unsplash.com/photo-1518736346281-76873166a64a?auto=format&fit=crop&w=600&q=75', 'wholesale', timestamptz '2025-11-29 08:05:00+00'),
  ('info@pamojapaint.co.tz', 'Pamoja Paint House', '+255 784 615 093', 'Dodoma',
   'https://images.unsplash.com/photo-1542238060-646c7ed65622?auto=format&fit=crop&w=600&q=75', 'retail', timestamptz '2026-01-10 09:40:00+00'),
  ('sales@tangaplumbing.co.tz', 'Tanga Plumbing & Electrical', '+255 738 529 441', 'Tanga',
   'https://images.unsplash.com/photo-1545193329-4a052e14eb8f?auto=format&fit=crop&w=600&q=75', 'company', timestamptz '2025-10-05 07:30:00+00'),
  ('orders@nyumbanisanitary.co.tz', 'Nyumbani Sanitary Ware', '+255 715 664 208', 'Dar es Salaam',
   'https://images.unsplash.com/photo-1631048499052-e6d9f305d2c0?auto=format&fit=crop&w=600&q=75', 'retail', timestamptz '2026-02-02 10:10:00+00'),
  ('sales@eastafricatoolshub.co.tz', 'East Africa Tools Hub', '+255 754 773 916', 'Dar es Salaam',
   'https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&w=600&q=75', 'wholesale', timestamptz '2025-09-30 08:50:00+00')
) as d(email, store_name, phone, region, photo, vendor_type, joined_at)
where not exists (select 1 from public.vendors v where v.email = d.email);

with data(vendor_email, name, category, price, unit, stock, max_stock, description, badge, image, rating, reviews) as (
  values
  -- Kilimanjaro Builders Supply (Arusha)
  ('orders@kilimanjarobuilders.co.tz', 'Twiga Ordinary Portland Cement 50kg', 'cement', 18500, 'bag', 420, 500,
   'General-purpose 32.5N cement for foundations, blockwork, and plastering. Pickup or delivery from Arusha.',
   'Best seller', 'https://images.unsplash.com/photo-1773394089934-3e29f2a3d6a9?auto=format&fit=crop&w=900&q=75', 4.8, 214),
  ('orders@kilimanjarobuilders.co.tz', 'PPC Portland Cement 50kg', 'cement', 19200, 'bag', 260, 320,
   'Premium 42.5N cement for structural concrete and high-strength works.',
   '', 'https://images.unsplash.com/photo-1730627283177-f43b83c3850c?auto=format&fit=crop&w=900&q=75', 4.7, 96),
  ('orders@kilimanjarobuilders.co.tz', 'Concrete Blocks 6 inch', 'cement', 3200, 'piece', 1800, 2200,
   'Machine-pressed hollow blocks for walls and partitions. Minimum order 50 pieces.',
   'In stock', 'https://images.unsplash.com/photo-1762380368593-a0d4c49af47f?auto=format&fit=crop&w=900&q=75', 4.6, 143),
  ('orders@kilimanjarobuilders.co.tz', 'Washed River Sand', 'aggregates', 58000, 'tonne', 120, 150,
   'Clean washed sand for concrete, mortar, and screeding. Delivered by tipper.',
   '', 'https://images.unsplash.com/photo-1632199670702-3ea3f70909cb?auto=format&fit=crop&w=900&q=75', 4.7, 81),
  ('orders@kilimanjarobuilders.co.tz', 'Crushed Stone 3/4 inch', 'aggregates', 65000, 'tonne', 90, 120,
   'Graded crushed stone for concrete and foundations. Delivery within Arusha.',
   '', 'https://images.unsplash.com/photo-1728988258941-efebc28c86eb?auto=format&fit=crop&w=900&q=75', 4.8, 64),
  ('orders@kilimanjarobuilders.co.tz', 'BRC Mesh 6mm 2.4x1.2m', 'steel', 42000, 'sheet', 140, 180,
   'Welded reinforcement mesh for slabs, driveways, and floor screeds.',
   '', 'https://images.unsplash.com/photo-1763771420551-18bc44399f0c?auto=format&fit=crop&w=900&q=75', 4.5, 37),

  -- Mzani Hardware & Cement (Mwanza)
  ('sales@mzanihardware.co.tz', 'Simba Cement 50kg', 'cement', 18200, 'bag', 600, 700,
   'Trusted 32.5N cement for everyday construction. Bulk discounts available.',
   'Best seller', 'https://images.unsplash.com/photo-1773394089934-3e29f2a3d6a9?auto=format&fit=crop&w=900&q=75', 4.9, 328),
  ('sales@mzanihardware.co.tz', 'Heavy Duty Wheelbarrow', 'tools', 95000, 'piece', 45, 60,
   'Reinforced steel tray and pneumatic tyre for site and garden work.',
   '', 'https://images.unsplash.com/photo-1645651964715-d200ce0939cc?auto=format&fit=crop&w=900&q=75', 4.6, 58),
  ('sales@mzanihardware.co.tz', 'Steel Shovel', 'tools', 18000, 'piece', 120, 150,
   'Tempered steel blade with a hardwood handle for digging and mixing.',
   '', 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&w=900&q=75', 4.5, 43),
  ('sales@mzanihardware.co.tz', 'Claw Hammer 16oz', 'tools', 22000, 'piece', 85, 110,
   'Forged steel head with a shock-absorbing handle for carpentry and general site work.',
   '', 'https://images.unsplash.com/photo-1426927308491-6380b6a9936f?auto=format&fit=crop&w=900&q=75', 4.7, 51),
  ('sales@mzanihardware.co.tz', 'Brass Padlock 50mm', 'hardware', 18000, 'piece', 200, 240,
   'Weather-resistant brass padlock with two keys for gates and stores.',
   '', 'https://images.unsplash.com/photo-1613945831677-383c19ad7721?auto=format&fit=crop&w=900&q=75', 4.4, 29),
  ('sales@mzanihardware.co.tz', 'Galvanised Nails 1kg', 'hardware', 7500, 'kg', 500, 600,
   'Assorted galvanised nails for roofing, timber, and general fixing.',
   '', 'https://images.unsplash.com/photo-1617123623686-2b7b339785da?auto=format&fit=crop&w=900&q=75', 4.6, 77),

  -- Dar Building Centre (Dar es Salaam)
  ('info@darbuildingcentre.co.tz', 'TMT Steel Rebar 12mm x 12m', 'steel', 32000, 'piece', 350, 450,
   'High-yield deformed bar for columns, beams, and slabs. Sold per 12 metre length.',
   'Top rated', 'https://images.unsplash.com/photo-1530863506128-dc9eb5c3e0fc?auto=format&fit=crop&w=900&q=75', 4.9, 187),
  ('info@darbuildingcentre.co.tz', 'TMT Steel Rebar 10mm x 12m', 'steel', 23000, 'piece', 420, 500,
   'High-yield reinforcement bar for stirrups and light structural work.',
   '', 'https://images.unsplash.com/photo-1623428454598-1bfe414bac03?auto=format&fit=crop&w=900&q=75', 4.8, 132),
  ('info@darbuildingcentre.co.tz', 'Marine Plywood 8x4 ft', 'timber', 68000, 'sheet', 110, 140,
   'Water-resistant plywood for formwork, roofing, and furniture.',
   '', 'https://images.unsplash.com/photo-1422246654994-34520d5a0340?auto=format&fit=crop&w=900&q=75', 4.7, 64),
  ('info@darbuildingcentre.co.tz', 'Mahogany Timber 2x4x12 ft', 'timber', 22000, 'piece', 260, 320,
   'Planed hardwood timber for framing, roofing, and joinery.',
   '', 'https://images.unsplash.com/photo-1634672652995-ee7525bce595?auto=format&fit=crop&w=900&q=75', 4.5, 48),
  ('info@darbuildingcentre.co.tz', 'Binding Wire 1kg', 'steel', 9000, 'kg', 300, 360,
   'Soft annealed wire for tying reinforcement bars on site.',
   '', 'https://images.unsplash.com/photo-1763771420551-18bc44399f0c?auto=format&fit=crop&w=900&q=75', 4.6, 39),
  ('info@darbuildingcentre.co.tz', 'Square Hollow Section 40x40mm', 'steel', 28000, 'length', 180, 220,
   'Galvanised square tube for gates, frames, and fabrication. 6 metre length.',
   '', 'https://images.unsplash.com/photo-1623428454598-1bfe414bac03?auto=format&fit=crop&w=900&q=75', 4.7, 26),

  -- Serengeti Steel Works (Arusha)
  ('sales@serengetisteel.co.tz', 'Angle Iron 40x40mm', 'steel', 24000, 'length', 160, 200,
   'Structural angle iron for fabrication, trusses, and supports. 6 metre length.',
   '', 'https://images.unsplash.com/photo-1530863506128-dc9eb5c3e0fc?auto=format&fit=crop&w=900&q=75', 4.6, 31),
  ('sales@serengetisteel.co.tz', 'Steel Plate 3mm', 'steel', 145000, 'sheet', 40, 55,
   'Mild steel plate for welding, repairs, and custom fabrication. 1.2m x 2.4m.',
   '', 'https://images.unsplash.com/photo-1763771420551-18bc44399f0c?auto=format&fit=crop&w=900&q=75', 4.5, 18),
  ('sales@serengetisteel.co.tz', 'Expanded Metal Mesh', 'steel', 38000, 'sheet', 70, 90,
   'Diamond mesh for security grilles, fencing, and reinforcement.',
   '', 'https://images.unsplash.com/photo-1623428454598-1bfe414bac03?auto=format&fit=crop&w=900&q=75', 4.4, 22),

  -- Coastal Tile Gallery (Dar es Salaam)
  ('hello@coastaltile.co.tz', 'Ceramic Floor Tile 60x60cm', 'tiles', 28000, 'm²', 900, 1100,
   'Glazed ceramic floor tile with a matte finish for living areas and corridors.',
   'Best seller', 'https://images.unsplash.com/photo-1523350165414-082d792c4bcc?auto=format&fit=crop&w=900&q=75', 4.8, 176),
  ('hello@coastaltile.co.tz', 'Porcelain Wall Tile 30x60cm', 'tiles', 24000, 'm²', 700, 850,
   'Rectified porcelain wall tile for bathrooms, kitchens, and feature walls.',
   '', 'https://images.unsplash.com/photo-1551893478-d726eaf0442c?auto=format&fit=crop&w=900&q=75', 4.7, 91),
  ('hello@coastaltile.co.tz', 'Anti-Slip Bathroom Tile 30x30cm', 'tiles', 19500, 'm²', 480, 600,
   'Textured anti-slip tile for wet rooms, showers, and outdoor steps.',
   '', 'https://images.unsplash.com/photo-1706629503586-2731f65587ae?auto=format&fit=crop&w=900&q=75', 4.6, 54),
  ('hello@coastaltile.co.tz', 'Tile Adhesive 20kg', 'tiles', 18000, 'bag', 240, 300,
   'Cement-based adhesive for ceramic and porcelain tiles. Covers approximately 5 m².',
   '', 'https://images.unsplash.com/photo-1523350165414-082d792c4bcc?auto=format&fit=crop&w=900&q=75', 4.5, 67),
  ('hello@coastaltile.co.tz', 'Wall Basin with Pedestal', 'sanitary', 145000, 'set', 35, 45,
   'White ceramic basin and pedestal with a single tap hole. Waste kit included.',
   '', 'https://images.unsplash.com/photo-1595514535316-b8c85bf9bbf9?auto=format&fit=crop&w=900&q=75', 4.6, 24),

  -- Highland Roofing Co. (Mbeya)
  ('orders@highlandroofing.co.tz', 'Corrugated Iron Sheet 3m', 'roofing', 38000, 'sheet', 540, 650,
   '28 gauge galvanised sheet for durable pitched roofs. Cut to length on request.',
   'Best seller', 'https://images.unsplash.com/photo-1673645652350-6a4c31c1c78f?auto=format&fit=crop&w=900&q=75', 4.8, 203),
  ('orders@highlandroofing.co.tz', 'Corrugated Iron Sheet 2m', 'roofing', 26000, 'sheet', 620, 720,
   '28 gauge galvanised sheet for extensions, sheds, and repairs.',
   '', 'https://images.unsplash.com/photo-1680035579849-3185807fb1ea?auto=format&fit=crop&w=900&q=75', 4.6, 88),
  ('orders@highlandroofing.co.tz', 'Clay Roof Tile', 'roofing', 2200, 'piece', 2400, 3000,
   'Fired clay interlocking tile in terracotta. Sold per piece.',
   '', 'https://images.unsplash.com/photo-1518736346281-76873166a64a?auto=format&fit=crop&w=900&q=75', 4.7, 71),
  ('orders@highlandroofing.co.tz', 'Ridge Cap 3m', 'roofing', 22000, 'piece', 180, 220,
   'Galvanised ridge cap to finish the roof peak and prevent water ingress.',
   '', 'https://images.unsplash.com/photo-1600612707884-c424a2ba812e?auto=format&fit=crop&w=900&q=75', 4.5, 34),
  ('orders@highlandroofing.co.tz', 'Roofing Nails 1kg', 'roofing', 8000, 'kg', 400, 480,
   'Umbrella-head roofing nails with rubber washers for iron sheets.',
   '', 'https://images.unsplash.com/photo-1617123623686-2b7b339785da?auto=format&fit=crop&w=900&q=75', 4.6, 59),

  -- Pamoja Paint House (Dodoma)
  ('info@pamojapaint.co.tz', 'Weather Guard Paint 20L', 'paint', 245000, 'bucket', 60, 80,
   'Long-life exterior emulsion with UV and rain protection. Tintable to over 200 colours.',
   'Top rated', 'https://images.unsplash.com/photo-1542238060-646c7ed65622?auto=format&fit=crop&w=900&q=75', 4.9, 142),
  ('info@pamojapaint.co.tz', 'Acrylic Emulsion Paint 10L', 'paint', 68000, 'bucket', 110, 140,
   'Low-odour interior emulsion with a washable matt finish.',
   '', 'https://images.unsplash.com/photo-1525909002-1b05e0c869d8?auto=format&fit=crop&w=900&q=75', 4.7, 96),
  ('info@pamojapaint.co.tz', 'Wall Primer 20L', 'paint', 125000, 'bucket', 75, 95,
   'Alkali-resistant primer for new plaster and concrete walls.',
   '', 'https://images.unsplash.com/photo-1542238060-646c7ed65622?auto=format&fit=crop&w=900&q=75', 4.6, 48),
  ('info@pamojapaint.co.tz', 'Paint Roller Set', 'paint', 15000, 'set', 180, 220,
   'Nine-inch roller, tray, and two refills for smooth wall coverage.',
   '', 'https://images.unsplash.com/photo-1525909002-1b05e0c869d8?auto=format&fit=crop&w=900&q=75', 4.4, 37),
  ('info@pamojapaint.co.tz', 'Masking Tape 50mm', 'paint', 6500, 'roll', 300, 360,
   'Low-tack tape for clean edges on walls, frames, and trim.',
   '', 'https://images.unsplash.com/photo-1535673774336-ef95d2851cf3?auto=format&fit=crop&w=900&q=75', 4.5, 41),

  -- Tanga Plumbing & Electrical (Tanga)
  ('sales@tangaplumbing.co.tz', 'PVC Pipe 4 inch x 6m', 'plumbing', 28000, 'piece', 260, 320,
   'Heavy-duty uPVC soil pipe for drainage and waste lines. 6 metre length.',
   '', 'https://images.unsplash.com/photo-1545193329-4a052e14eb8f?auto=format&fit=crop&w=900&q=75', 4.7, 83),
  ('sales@tangaplumbing.co.tz', 'HDPE Pipe 63mm', 'plumbing', 9500, 'metre', 800, 1000,
   'Flexible polyethylene pipe for water supply and irrigation.',
   '', 'https://images.unsplash.com/photo-1729169927271-7826d8aae360?auto=format&fit=crop&w=900&q=75', 4.6, 57),
  ('sales@tangaplumbing.co.tz', 'PP-R Pipe 25mm', 'plumbing', 7800, 'metre', 650, 800,
   'Hot and cold water pipe with heat-fused joints.',
   '', 'https://images.unsplash.com/photo-1529269421632-e9253d14d3a9?auto=format&fit=crop&w=900&q=75', 4.5, 44),
  ('sales@tangaplumbing.co.tz', 'Twin Socket 13A', 'electrical', 14500, 'piece', 220, 280,
   'White switched twin socket with child-safe shutters.',
   '', 'https://images.unsplash.com/photo-1607631755187-298a3f9a640a?auto=format&fit=crop&w=900&q=75', 4.6, 62),
  ('sales@tangaplumbing.co.tz', 'Copper Cable 2.5mm² 100m', 'electrical', 195000, 'roll', 85, 110,
   'PVC-insulated copper cable for sockets and lighting circuits.',
   'In stock', 'https://images.unsplash.com/photo-1518181835702-6eef8b4b2113?auto=format&fit=crop&w=900&q=75', 4.8, 109),
  ('sales@tangaplumbing.co.tz', 'MCB Circuit Breaker 32A', 'electrical', 28000, 'piece', 140, 180,
   'Single-pole miniature circuit breaker for distribution boards.',
   '', 'https://images.unsplash.com/photo-1717667745852-a5bd6876c1de?auto=format&fit=crop&w=900&q=75', 4.7, 38),
  ('sales@tangaplumbing.co.tz', 'LED Floodlight 100W', 'electrical', 45000, 'piece', 95, 120,
   'Weatherproof LED floodlight for yards, gates, and site lighting.',
   '', 'https://images.unsplash.com/photo-1717667745852-a5bd6876c1de?auto=format&fit=crop&w=900&q=75', 4.5, 33),

  -- Nyumbani Sanitary Ware (Dar es Salaam)
  ('orders@nyumbanisanitary.co.tz', 'Close-Coupled Toilet Suite', 'sanitary', 285000, 'set', 28, 40,
   'Floor-mounted ceramic toilet with dual flush and soft-close seat.',
   'Top rated', 'https://images.unsplash.com/photo-1631048499052-e6d9f305d2c0?auto=format&fit=crop&w=900&q=75', 4.8, 66),
  ('orders@nyumbanisanitary.co.tz', 'Ceramic Wash Basin', 'sanitary', 125000, 'piece', 40, 55,
   'Wall-hung ceramic basin with overflow and fixing kit.',
   '', 'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=900&q=75', 4.6, 31),
  ('orders@nyumbanisanitary.co.tz', 'Chrome Shower Mixer', 'sanitary', 165000, 'set', 32, 45,
   'Single-lever chrome mixer with a hand shower and flexible hose.',
   '', 'https://images.unsplash.com/photo-1595514535316-b8c85bf9bbf9?auto=format&fit=crop&w=900&q=75', 4.7, 27),
  ('orders@nyumbanisanitary.co.tz', 'Double Bowl Kitchen Sink', 'sanitary', 230000, 'piece', 24, 35,
   'Stainless steel double-bowl sink with drainboard and basket waste.',
   '', 'https://images.unsplash.com/photo-1631048499052-e6d9f305d2c0?auto=format&fit=crop&w=900&q=75', 4.5, 19),

  -- East Africa Tools Hub (Dar es Salaam)
  ('sales@eastafricatoolshub.co.tz', 'Rotary Hammer Drill 800W', 'tools', 240000, 'piece', 38, 50,
   'SDS-plus rotary hammer for concrete drilling and light chipping.',
   'Best seller', 'https://images.unsplash.com/photo-1426927308491-6380b6a9936f?auto=format&fit=crop&w=900&q=75', 4.8, 74),
  ('sales@eastafricatoolshub.co.tz', 'Angle Grinder 900W', 'tools', 135000, 'piece', 52, 70,
   'Compact angle grinder with a 115mm disc for cutting and grinding metal.',
   '', 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&w=900&q=75', 4.6, 58),
  ('sales@eastafricatoolshub.co.tz', 'Spirit Level 1.2m', 'tools', 38000, 'piece', 70, 90,
   'Aluminium box level with three vials for accurate levelling.',
   '', 'https://images.unsplash.com/photo-1645651964715-d200ce0939cc?auto=format&fit=crop&w=900&q=75', 4.5, 36),
  ('sales@eastafricatoolshub.co.tz', 'Safety Helmet', 'tools', 16000, 'piece', 240, 300,
   'Impact-resistant helmet with adjustable harness for site safety.',
   '', 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&w=900&q=75', 4.7, 45)
)
insert into public.products (
  vendor_email, vendor, name, category, price, unit, stock, max_stock,
  description, badge, image, rating, reviews, deleted, variants, status
)
select
  d.vendor_email,
  v.store_name,
  d.name,
  d.category,
  d.price,
  d.unit,
  d.stock,
  d.max_stock,
  d.description,
  d.badge,
  d.image,
  d.rating,
  d.reviews,
  false,
  '[]'::jsonb,
  'active'
from data d
join public.vendors v on v.email = d.vendor_email
where not exists (
  select 1 from public.products p
  where p.vendor_email = d.vendor_email and p.name = d.name
);
