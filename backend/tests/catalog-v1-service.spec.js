const assert = require('assert');
const { normalizeBikeRow, buildFilters } = require('../src/services/catalog-v1-service');

describe('catalog-v1-service', () => {
  it('normalizes image arrays and keeps main image first', () => {
    const row = {
      id: 77,
      name: 'Test Bike',
      brand: 'BrandX',
      model: 'ModelY',
      price_eur: 1000,
      is_active: 1,
      main_image: 'https://example.com/main.jpg',
      images: JSON.stringify([
        'https://example.com/other.jpg',
        'https://ik.imagekit.io/demo/priority.webp'
      ]),
      gallery: null,
      unified_data: JSON.stringify({
        media: {
          gallery: ['https://example.com/from-unified.jpg']
        }
      })
    };

    const dto = normalizeBikeRow(row);

    assert.strictEqual(dto.id, 77);
    assert.strictEqual(dto.name, 'Test Bike');
    assert.strictEqual(dto.main_image, 'https://example.com/main.jpg');
    assert.ok(Array.isArray(dto.images));
    assert.strictEqual(dto.images[0], 'https://example.com/main.jpg');
    assert.ok(dto.images.includes('https://ik.imagekit.io/demo/priority.webp'));
  });

  it('builds filters with defaults and booleans', () => {
    const filters = buildFilters({
      sort: 'price_desc',
      page: '3',
      page_size: '12',
      category: 'mtb,road',
      is_hot_offer: 'true',
      ready_to_ship: 'false'
    });

    assert.strictEqual(filters.sort, 'price_desc');
    assert.strictEqual(filters.page, 3);
    assert.strictEqual(filters.page_size, 12);
    assert.deepStrictEqual(filters.category, ['mtb', 'road']);
    assert.strictEqual(filters.is_hot_offer, true);
    assert.strictEqual(filters.ready_to_ship, false);
  });
});
