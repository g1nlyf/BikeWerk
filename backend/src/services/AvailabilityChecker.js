class AvailabilityChecker {
  static async checkBikeAvailability(bike) {
    // Mock logic for validation test
    // In production this would use Puppeteer/Fetch
    if (bike.source_url && (bike.source_url.includes('sold') || bike.source_url.includes('deleted'))) {
        return 'sold';
    }
    return 'active';
  }
}

module.exports = AvailabilityChecker;
