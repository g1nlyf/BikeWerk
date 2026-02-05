
const BRAND_MODELS = {
    'MTB DH': {
        brands: ['Santa Cruz', 'Trek', 'Specialized', 'Canyon', 'YT', 'Commencal', 'Scott', 'Cube', 'Giant', 'Propain'],
        models: ['V10', 'Session', 'Demo', 'Sender', 'Tues', 'Supreme', 'Gambler', 'Two15', 'Glory', 'Rage']
    },
    'MTB Enduro': {
        brands: ['Santa Cruz', 'Trek', 'Specialized', 'Canyon', 'YT', 'Commencal', 'Scott', 'Cube', 'Giant', 'Orbea', 'Propain', 'Radon'],
        models: ['Megatower', 'Nomad', 'Slash', 'Enduro', 'Strive', 'Torque', 'Capra', 'Meta AM', 'Meta SX', 'Ransom', 'Stereo 170', 'Reign', 'Rallon', 'Tyee', 'Swoop']
    },
    'MTB Trail': {
        brands: ['Santa Cruz', 'Trek', 'Specialized', 'Canyon', 'YT', 'Commencal', 'Scott', 'Cube', 'Giant', 'Orbea', 'Radon', 'Rocky Mountain', 'Norco', 'Pivot'],
        models: ['Hightower', '5010', 'Tallboy', 'Fuel EX', 'Stumpjumper', 'Spectral', 'Neuron', 'Jeffsy', 'Meta TR', 'Genius', 'Stereo 140', 'Stereo 150', 'Trance', 'Occam', 'Slide', 'Skeen', 'Chameleon', 'Roscoe', 'Stoic', 'Status', 'Fuse', 'Fluid', 'Smuggler', 'Optic', 'Hugene', 'Izzo']
    },
    'MTB XC': {
        brands: ['Specialized', 'Trek', 'Scott', 'Canyon', 'Cube', 'Giant', 'Orbea', 'Cannondale', 'BMC', 'Santa Cruz', 'Ghost', 'Rose', 'Focus'],
        models: ['Epic', 'Supercaliber', 'Top Fuel', 'Spark', 'Scale', 'Lux', 'Exceed', 'AMS', 'Elite', 'Anthem', 'Oiz', 'Scalpel', 'Fourstroke', 'Highball', 'Blur', 'Chisel', 'X-Caliber', 'Marlin', 'Grand Canyon', 'Alma', 'Procaliber', 'Lector', 'Raven', 'Psycho Path']
    },
    'Road Aero': {
        brands: ['Trek', 'Specialized', 'Canyon', 'Scott', 'Giant', 'Merida', 'Cube', 'Cervelo', 'BMC'],
        models: ['Madone', 'Venge', 'Aeroad', 'Foil', 'Propel', 'Reacto', 'Litening', 'S5', 'Timemachine Road']
    },
    'Road Endurance': {
        brands: ['Trek', 'Specialized', 'Canyon', 'Scott', 'Giant', 'Cube', 'Merida', 'Cannondale', 'BMC'],
        models: ['Domane', 'Roubaix', 'Endurace', 'Addict', 'Defy', 'Attain', 'Agree', 'Scultura Endurance', 'Synapse', 'Roadmachine']
    },
    'Road Climbing': {
        brands: ['Trek', 'Specialized', 'Canyon', 'Scott', 'Giant', 'Cannondale', 'BMC', 'Pinarello'],
        models: ['Emonda', 'Aethos', 'Tarmac', 'Ultimate', 'Addict RC', 'TCR', 'SuperSix', 'Teammachine', 'Dogma']
    },
    'Road TT/Triathlon': {
        brands: ['Canyon', 'Trek', 'Specialized', 'Scott', 'Cube', 'Cervelo', 'BMC'],
        models: ['Speedmax', 'Speed Concept', 'Shiv', 'Plasma', 'Aerium', 'P5', 'Timemachine']
    },
    'Gravel Race': {
        brands: ['Canyon', 'Specialized', 'Trek', 'Scott', 'Cervelo', 'BMC', '3T'],
        models: ['Grail', 'Crux', 'Checkpoint', 'Addict Gravel', 'Aspero', 'Kaius', 'Exploro']
    },
    'Gravel All-road': {
        brands: ['Canyon', 'Specialized', 'Trek', 'Giant', 'Cube', 'Scott', 'Rose', 'Cannondale'],
        models: ['Grizl', 'Diverge', 'Checkpoint', 'Revolt', 'Nuroad', 'Speedster Gravel', 'Backroad', 'Topstone']
    },
    'Gravel Bikepacking': {
        brands: ['Canyon', 'Specialized', 'Trek', 'Giant', 'Cube', 'Rose', 'Cannondale', 'Salsa'],
        models: ['Grizl', 'Diverge', 'Checkpoint', 'Revolt', 'Nuroad', 'Backroad', 'Topstone', 'Cutthroat', 'Warbird']
    },
    'eMTB': {
        brands: ['Specialized', 'Trek', 'Canyon', 'YT', 'Cube', 'Scott', 'Giant', 'Orbea', 'Commencal', 'Haibike'],
        models: ['Levo', 'Kenevo', 'Rail', 'Powerfly', 'Spectral:ON', 'Torque:ON', 'Decoy', 'Stereo Hybrid', 'Patron', 'Strike', 'Reign E+', 'Trance X E+', 'Wild', 'Rise', 'Meta Power', 'AllMtn']
    }
};

module.exports = { BRAND_MODELS };
