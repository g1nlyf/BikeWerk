class ManualPreprocessor {
    preprocess(rawData = {}) {
        const images = [];
        if (Array.isArray(rawData.images)) images.push(...rawData.images);
        if (rawData.image) images.push(rawData.image);

        return {
            title: rawData.title,
            brand: rawData.brand,
            model: rawData.model,
            description: rawData.description,
            price: rawData.price,
            original_price: rawData.original_price,
            year: rawData.year,
            frame_size: rawData.frame_size,
            condition: rawData.condition,
            components: rawData.components || {},
            general_info: rawData.general_info || rawData.general || {},
            images,
            url: rawData.url,
            source_platform: 'manual',
            source_ad_id: rawData.external_id || rawData.id || null
        };
    }
}

module.exports = new ManualPreprocessor();
