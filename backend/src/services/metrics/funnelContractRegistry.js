const FUNNEL_CONTRACT_REGISTRY = {
    version: '2026.02.14',
    criticalPath: [
        'page_view',
        'detail_open',
        'checkout_submit_attempt',
        'booking_success'
    ],
    eventContracts: {
        page_view: {
            stage: 'page',
            requiredGroups: [
                ['sourcePath', 'metadata.path', 'context.sourcePath']
            ]
        },
        detail_open: {
            stage: 'product',
            requiredGroups: [
                ['bikeId', 'metadata.bike_id'],
                ['sourcePath', 'metadata.path', 'context.sourcePath']
            ]
        },
        checkout_submit_attempt: {
            stage: 'checkout',
            requiredGroups: [
                ['sourcePath', 'metadata.path', 'context.sourcePath'],
                ['metadata.stage', 'metadata.formId']
            ]
        },
        booking_success: {
            stage: 'booking',
            requiredGroups: [
                ['bikeId', 'metadata.bike_id'],
                ['sourcePath', 'metadata.path', 'context.sourcePath']
            ]
        },
        order: {
            stage: 'booking',
            requiredGroups: [
                ['bikeId', 'metadata.bike_id', 'metadata.order_id']
            ]
        }
    }
};

module.exports = {
    FUNNEL_CONTRACT_REGISTRY
};
