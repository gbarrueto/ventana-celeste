let FO,FD,FT,FS,K,MZZ,XX,BS,FB,DP,FP,FA,FM,FC,B,CC,KK,FE, TH,FR,I,IS,M;

// Telescope parameters
let DIAMETER = 100; 
let FOCAL_LENGTH = 1200;
let EYEPIECE_FL = 25;
let EYEPIECE_AFOV = 50; // degrees
let CLEANLINESS = 0; // Clean: 0, Average: 0.15, Dirty: 0.3
let TELESCOPE_TYPE = 2; // Reflector: 1, Refractor: 2, SCT: 3
let COATING = 88; // Standart: 88, Enhanced: 95

// Observer parameters

let PUPIL = 7; // mm
let AGE = 30; // years
let EXPERIENCE = 3; // Beginner: 1, Expert: 9

// Sky parameters

let SQM_READING = 20; // mag/arcsec^2. Can be affected by moonlight or manual setting
let CITY_SQM_READING = 20; // Fixed value for city sky brightness when simulating light pollution
let SEEING_DISK_DIAMETER = 1; // arcseconds
let ZENITH_DISTANCE = 30; // degrees
let STAR_COLOR_INDEX = 0; // Blue: 0, White: 1, Yellow: 2, Orange: 3, Red: 4
let EXTINCTION = 0.3; // mag/airmass