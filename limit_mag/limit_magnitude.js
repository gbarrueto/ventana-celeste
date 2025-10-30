
export function radioValue(e) {
    for (var i = 0; i < e.length; i++) if (e[i].checked) return e[i].value;
}
export function computeEyePupil() {
    var AG = parseInt(AGE);
    if (!isNaN(AG)) {
        var DE = 7 * Math.exp(-AG * AG / 20000);        // DIAM EYE PUPIL IN MM
        if (DE < 4) DE = 4;
        document.forms[0].eyeexit.value = Math.round(DE * 10) / 10;
    }
}
export function computeNELM() {
    // var ff = document.forms[0];
    var SQ = parseFloat(SQM_READING);

    if (!isNaN(SQ)) {
        // var KV = parseFloat(EXTINCTION);
        var BS = 34.08 * Math.exp(20.7233 - 0.92104 * SQ)
        var MZ = 8.68 - 5 * Math.log(1 + 0.158 * Math.sqrt(BS)) / Math.LN10
        return Math.round(MZ * 10) / 10;
    }
}

export function calculate_limit_mag() {
    // var ff = document.forms[0];
    var UseInch = false; //ff.UNITS.selectedIndex == 1;
    var D = parseFloat(DIAMETER); // Telescope aperture in mm
    if (UseInch) D = D * 25.4;

    var MG = parseFloat(FOCAL_LENGTH / EYEPIECE_FL); // MAGNIFICATION
    var MZ = parseFloat(computeNELM());
    // if (isNaN(MZ)) {
    //     computeNELM();
    //     MZ = parseFloat(ff.limit.value);
    // }
    var CI = parseFloat(STAR_COLOR_INDEX);
    var Z = parseFloat(ZENITH_DISTANCE) * Math.PI / 180;
    var KV = parseFloat(EXTINCTION);
    var SE = parseFloat(SEEING_DISK_DIAMETER);
    // var EX = parseFloat(radioValue(EXPERIENCE))
    var EX = EXPERIENCE;
    var DE = parseFloat(PUPIL);
    // if (isNaN(DE)) {
    //     computeEyePupil();
    //     DE = parseFloat(ff.eyeexit.value);
    // }
    var TelescopeType = TELESCOPE_TYPE;
    var Reflectivity = 0.01 * (COATING);
    var CL = parseFloat(CLEANLINESS);

    // Compute transmission of telescope
    var DS, FL
    if (TelescopeType == 2) {           // refractor
        DS = 0;                         // no central obstruction
        FL = Math.pow(0.99, 4);          // 99% transmission on 4 air-glass surfaces
    }
    else if (TelescopeType == 1) {      // reflector
        DS = 0.20 * D;                    // 20% CO
        FL = Math.pow(Reflectivity, 2);  // 88% reflectivity on 2 surfaces
    }
    else if (TelescopeType == 3) {      // SCT
        DS = 0.35 * D;                    // 35% CO
        FL = Math.pow(0.99 * Reflectivity, 2);  // 2 air-glass surfaces, 2 reflections
    }
    FD = 1.0 - Math.pow(DS / D, 2);        // obstruction 
    FO = 0.94;		                    // eyepiece transmission (4 coated air-glass surfaces)
    if (TelescopeType != 1)
        FO = FO * 0.97                    // diagonal 97% reflectivity
    FO = FO * (1 - CL)                  // dirty optics
    FT = 1 / (FL * FD * FO);                  // total transmission of telescope

    // Compute sky brightness from NELM in zenith
    FS = 1.0;                           // observer's eyesight
    K = 1.2 * KV;                       // extinction corrected to 510 nm (averted vision)
    MZZ = MZ + K;                       // zenith NELM without atmosphere
    if (MZZ >= 7) {
        BS = 54;		                // best possible sky brightness => Ba = 21.58
        FS = Math.pow(10, 0.4 * (7 - MZZ));	// good eyesight correction
    }
    else {
        XX = 0.2 * (8.68 - MZZ);               //  FS ASSUMED = 1  ; 8.68 = 7.93 + 0.75
        BS = 39.7 * Math.pow((Math.pow(10, XX) - 1), 2);              // SKY BRIGHTNESS FOR MZ
    };

    // Compute sky brightness in telescope
    FB = Math.sqrt(2);                  // binocular vision
    DP = D / MG;                          // diam of exit pupil
    FP = 1.0;
    if (DE < DP) FP = DP * DP / (DE * DE);    // light outside pupil
    FA = DE * DE / (D * D);                   // light-collecting area
    FM = MG * MG;                         // spread of sky photons
    FC = Math.pow(10, 0.4 * (CI / 2 - 1));     // color of star
    BS = BS * (1 + 0.5 * Z * Z);		    // correction for zenith distance
    B = BS / (FB * FT * FP * FA * FM * FC);  // background brightness in telescope

    // Compute Limiting Magnitude in telescope
    CC = 1.58e-10;                      // night-vision constant
    KK = 0.0126;                        // night-vision constant
    FE = Math.pow(10, 0.4 * K / Math.cos(Z)); // atmospheric extinction
    TH = SE * MG;                         // apparent diameter of seeing disk (arc-sec)  corrections
    FR = 1.0;
    if (TH > 900) FR = Math.sqrt(TH / 900); // a point source can appear extended
    I = CC * Math.pow(1 + Math.sqrt(KK * B), 2);	  // Hecht (JOSA,v37,p59,1947)
    IS = I * FB * FE * FT * FP * FA * FR * FC * FS;     	  // for no scope, no air
    M = -16.57 - 2.5 * Math.log(IS) / Math.LN10;  // intensity to v mag
    M = M + (EX - 6) * 0.16;				// empirical experience correction
    // document.getElementById('magnitude').innerHTML = Math.round(M * 10) / 10;

    return Math.round(M * 10) / 10;
}