class InquiryGenerator {
    /**
     * Generate questions for the seller based on missing bike data
     * @param {Object} bike 
     * @returns {string[]} List of questions
     */
    static generate(bike) {
        const questions = [];
        const specs = bike.specs || {}; // Assuming specs is an object or array

        // 1. Year Check
        if (!bike.year) {
            questions.push("Welches Modelljahr ist das Fahrrad genau?");
        }

        // 2. Mileage / Usage
        if (!bike.mileage && !bike.odometer) {
            questions.push("Wie viele Kilometer wurde das Rad ca. gefahren?");
        }

        // 3. Last Service
        if (!bike.last_service) {
            questions.push("Wann war der letzte Service (Gabel/Dämpfer)?");
        }

        // 4. Cracks / Damage (Always ask if not explicitly "No cracks")
        if (!bike.condition_description?.toLowerCase().includes('cracks') && !bike.condition_description?.toLowerCase().includes('risse')) {
            questions.push("Gibt es Risse, Dellen oder Carbon-Schäden, die auf den Fotos nicht zu sehen sind?");
        }

        // 5. Components Check (e.g. Chain wear)
        questions.push("Wie ist der Zustand der Verschleißteile (Kette, Kassette)?");

        // 6. Documents
        if (!bike.has_papers) {
            questions.push("Sind Originalrechnung und Dokumente vorhanden?");
        }

        return questions;
    }
}

module.exports = InquiryGenerator;
