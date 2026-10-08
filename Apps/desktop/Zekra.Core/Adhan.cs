// A line-by-line port of adhan-js 4.4.6 (https://github.com/batoulapps/adhan-js, MIT License,
// Copyright (c) 2016 Batoul Apps), the library the site computes prayer times with, so the app
// shows the same minute. Only what the site uses: its methods, madhab, adjustments; the default
// high-latitude rule (middle of the night), no polar-circle resolution, shafaq "general".
// Times are JavaScript Date values: milliseconds since the epoch, NaN for an invalid date.
namespace Zekra.Core;

internal sealed class AdhanParams(string method, double fajrAngle, double ishaAngle, double ishaInterval = 0)
{
    public string Method = method;
    public double FajrAngle = fajrAngle, IshaAngle = ishaAngle, IshaInterval = ishaInterval;
    public bool Hanafi;
    public bool RoundUp;
    public readonly double[] Adjustments = new double[6];
    public readonly double[] MethodAdjustments = new double[6];

    public static AdhanParams? For(string method)
    {
        AdhanParams p;
        switch (method)
        {
            case "MuslimWorldLeague": p = new(method, 18, 17); p.MethodAdjustments[2] = 1; break;
            case "Egyptian": p = new(method, 19.5, 17.5); p.MethodAdjustments[2] = 1; break;
            case "Karachi": p = new(method, 18, 18); p.MethodAdjustments[2] = 1; break;
            case "UmmAlQura": p = new(method, 18.5, 0, 90); break;
            case "Dubai": p = new(method, 18.2, 18.2); Set(p, 0, -3, 3, 3, 3, 0); break;
            case "MoonsightingCommittee": p = new(method, 18, 18); Set(p, 0, 0, 5, 0, 3, 0); break;
            case "NorthAmerica": p = new(method, 15, 15); p.MethodAdjustments[2] = 1; break;
            case "Kuwait": p = new(method, 18, 17.5); break;
            case "Qatar": p = new(method, 18, 0, 90); break;
            case "Singapore": p = new(method, 20, 18) { RoundUp = true }; p.MethodAdjustments[2] = 1; break;
            case "Turkey": p = new(method, 18, 17); Set(p, 0, -7, 5, 4, 7, 0); break;
            default: return null;
        }
        return p;
    }

    static void Set(AdhanParams p, params double[] a) => a.CopyTo(p.MethodAdjustments, 0);
}

internal static class Adhan
{
    const double HighLatitudeThreshold = 55;

    /// <summary>fajr, sunrise, dhuhr, asr, maghrib, isha in epoch ms (NaN where invalid).</summary>
    public static double[] Times(double latitude, double longitude, int year, int month, int day, AdhanParams p)
    {
        var solar = new SolarTime(year, month, day, latitude, longitude);
        var dhuhr = UtcDate(solar.Transit, year, month, day);
        var sunrise = UtcDate(solar.Sunrise, year, month, day);
        var sunset = UtcDate(solar.Sunset, year, month, day);
        var t = new DateOnly(year, month, day).AddDays(1);
        var tomorrowSolar = new SolarTime(t.Year, t.Month, t.Day, latitude, longitude);

        var asr = UtcDate(solar.Afternoon(p.Hanafi ? 2 : 1), year, month, day);
        var tomorrowSunrise = UtcDate(tomorrowSolar.Sunrise, t.Year, t.Month, t.Day);
        var night = (tomorrowSunrise - sunset) / 1000;
        var fajr = UtcDate(solar.HourAngle(-1 * p.FajrAngle, false), year, month, day);
        var mc = p.Method == "MoonsightingCommittee";
        var doy = new DateOnly(year, month, day).DayOfYear;

        if (mc && latitude >= HighLatitudeThreshold) fajr = AddSeconds(sunrise, -(night / 7));
        var safeFajr = mc
            ? SeasonAdjustedMorningTwilight(latitude, doy, year, sunrise)
            : AddSeconds(sunrise, -(0.5 * night));
        if (double.IsNaN(fajr) || safeFajr > fajr) fajr = safeFajr;

        double isha;
        if (p.IshaInterval > 0) isha = AddSeconds(sunset, p.IshaInterval * 60);
        else
        {
            isha = UtcDate(solar.HourAngle(-1 * p.IshaAngle, true), year, month, day);
            if (mc && latitude >= HighLatitudeThreshold) isha = AddSeconds(sunset, night / 7);
            var safeIsha = mc
                ? SeasonAdjustedEveningTwilight(latitude, doy, year, sunset)
                : AddSeconds(sunset, 0.5 * night);
            if (double.IsNaN(isha) || safeIsha < isha) isha = safeIsha;
        }

        double[] raw = [fajr, sunrise, dhuhr, asr, sunset, isha];
        var result = new double[6];
        for (var i = 0; i < 6; i++)
            result[i] = RoundedMinute(AddSeconds(raw[i], (p.Adjustments[i] + p.MethodAdjustments[i]) * 60), p.RoundUp);
        return result;
    }

    // --- DateUtils / TimeComponents (JavaScript Date semantics) ---

    /// <summary>new Date(x): a fractional time value is truncated toward zero (TimeClip).</summary>
    static double TimeClip(double ms) => double.IsFinite(ms) ? Math.Truncate(ms) : double.NaN;

    static double AddSeconds(double ms, double seconds) => TimeClip(ms + seconds * 1000);

    static double RoundedMinute(double ms, bool up)
    {
        if (double.IsNaN(ms)) return ms;
        var seconds = Math.Floor(JsMod(ms, 60000) / 1000);
        var offset = up ? 60 - seconds : seconds >= 30 ? 60 - seconds : -1 * seconds;
        return AddSeconds(ms, offset);
    }

    static double JsMod(double a, double b) => a - b * Math.Floor(a / b);

    /// <summary>new TimeComponents(num).utcDate(y, m, d) → Date.UTC(y, m-1, d, hours, minutes, seconds).</summary>
    static double UtcDate(double num, int year, int month, int day)
    {
        if (!double.IsFinite(num)) return double.NaN;
        var hours = Math.Floor(num);
        var minutes = Math.Floor((num - hours) * 60);
        var seconds = Math.Floor((num - (hours + minutes / 60)) * 60 * 60);
        var days = new DateOnly(year, month, day).DayNumber - 719162; // days since 1970-01-01
        return TimeClip(days * 86400000.0 + hours * 3600000 + minutes * 60000 + seconds * 1000);
    }

    static bool IsLeapYear(int year) => year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);

    /// <summary>JavaScript Math.round: halves go up.</summary>
    static double JsRound(double x) => Math.Floor(x + 0.5);

    // --- MathUtils ---

    static double Rad(double d) => d * Math.PI / 180.0;
    static double Deg(double r) => r * 180.0 / Math.PI;
    static double NormalizeToScale(double num, double max) => num - max * Math.Floor(num / max);
    static double Unwind(double angle) => NormalizeToScale(angle, 360.0);
    static double QuadrantShift(double angle) => angle is >= -180 and <= 180 ? angle : angle - 360 * JsRound(angle / 360);

    // --- Astronomical ---

    static double MeanSolarLongitude(double T) => Unwind(280.4664567 + 36000.76983 * T + 0.0003032 * Math.Pow(T, 2));
    static double MeanLunarLongitude(double T) => Unwind(218.3165 + 481267.8813 * T);
    static double AscendingLunarNodeLongitude(double T) => Unwind(125.04452 - 1934.136261 * T + 0.0020708 * Math.Pow(T, 2) + Math.Pow(T, 3) / 450000);
    static double MeanSolarAnomaly(double T) => Unwind(357.52911 + 35999.05029 * T - 0.0001537 * Math.Pow(T, 2));

    static double SolarEquationOfTheCenter(double T, double M)
    {
        var mrad = Rad(M);
        var term1 = (1.914602 - 0.004817 * T - 0.000014 * Math.Pow(T, 2)) * Math.Sin(mrad);
        var term2 = (0.019993 - 0.000101 * T) * Math.Sin(2 * mrad);
        var term3 = 0.000289 * Math.Sin(3 * mrad);
        return term1 + term2 + term3;
    }

    static double ApparentSolarLongitude(double T, double L0)
    {
        var longitude = L0 + SolarEquationOfTheCenter(T, MeanSolarAnomaly(T));
        var omega = 125.04 - 1934.136 * T;
        return Unwind(longitude - 0.00569 - 0.00478 * Math.Sin(Rad(omega)));
    }

    static double MeanObliquityOfTheEcliptic(double T) =>
        23.439291 - 0.013004167 * T - 0.0000001639 * Math.Pow(T, 2) + 0.0000005036 * Math.Pow(T, 3);

    static double ApparentObliquityOfTheEcliptic(double T, double e0) => e0 + 0.00256 * Math.Cos(Rad(125.04 - 1934.136 * T));

    static double MeanSiderealTime(double T)
    {
        var jd = T * 36525 + 2451545.0;
        return Unwind(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * Math.Pow(T, 2) - Math.Pow(T, 3) / 38710000);
    }

    static double NutationInLongitude(double L0, double Lp, double omega) =>
        -17.2 / 3600 * Math.Sin(Rad(omega)) - 1.32 / 3600 * Math.Sin(2 * Rad(L0)) - 0.23 / 3600 * Math.Sin(2 * Rad(Lp)) + 0.21 / 3600 * Math.Sin(2 * Rad(omega));

    static double NutationInObliquity(double L0, double Lp, double omega) =>
        9.2 / 3600 * Math.Cos(Rad(omega)) + 0.57 / 3600 * Math.Cos(2 * Rad(L0)) + 0.1 / 3600 * Math.Cos(2 * Rad(Lp)) - 0.09 / 3600 * Math.Cos(2 * Rad(omega));

    static double AltitudeOfCelestialBody(double phi, double delta, double H) =>
        Deg(Math.Asin(Math.Sin(Rad(phi)) * Math.Sin(Rad(delta)) + Math.Cos(Rad(phi)) * Math.Cos(Rad(delta)) * Math.Cos(Rad(H))));

    static double ApproximateTransit(double L, double theta0, double a2)
    {
        var m0 = NormalizeToScale((a2 + L * -1 - theta0) / 360, 1);
        var expected = NormalizeToScale((12.0 - L / 15.0) / 24.0, 1);
        return m0 - expected > 0.5 ? m0 - 1.0 : expected - m0 > 0.5 ? m0 + 1.0 : m0;
    }

    static double CorrectedTransit(double m0, double L, double theta0, double a2, double a1, double a3)
    {
        var theta = Unwind(theta0 + 360.985647 * m0);
        var a = Unwind(InterpolateAngles(a2, a1, a3, m0));
        var H = QuadrantShift(theta - L * -1 - a);
        return (m0 + H / -360) * 24;
    }

    static double CorrectedHourAngle(double m0, double h0, double lat, double lng, bool afterTransit, SolarCoordinates s, SolarCoordinates prev, SolarCoordinates next)
    {
        var lw = lng * -1;
        var term1 = Math.Sin(Rad(h0)) - Math.Sin(Rad(lat)) * Math.Sin(Rad(s.Declination));
        var term2 = Math.Cos(Rad(lat)) * Math.Cos(Rad(s.Declination));
        var H0 = Deg(Math.Acos(term1 / term2));
        var m = afterTransit ? m0 + H0 / 360 : m0 - H0 / 360;
        var theta = Unwind(s.ApparentSiderealTime + 360.985647 * m);
        var a = Unwind(InterpolateAngles(s.RightAscension, prev.RightAscension, next.RightAscension, m));
        var delta = Interpolate(s.Declination, prev.Declination, next.Declination, m);
        var H = theta - lw - a;
        var h = AltitudeOfCelestialBody(lat, delta, H);
        var dm = (h - h0) / (360 * Math.Cos(Rad(delta)) * Math.Cos(Rad(lat)) * Math.Sin(Rad(H)));
        return (m + dm) * 24;
    }

    static double Interpolate(double y2, double y1, double y3, double n)
    {
        var a = y2 - y1;
        var b = y3 - y2;
        return y2 + n / 2 * (a + b + n * (b - a));
    }

    static double InterpolateAngles(double y2, double y1, double y3, double n)
    {
        var a = Unwind(y2 - y1);
        var b = Unwind(y3 - y2);
        return y2 + n / 2 * (a + b + n * (b - a));
    }

    static double JulianDay(int year, int month, int day)
    {
        double Y = month > 2 ? year : year - 1;
        double M = month > 2 ? month : month + 12;
        var A = Math.Truncate(Y / 100);
        var B = Math.Truncate(2 - A + Math.Truncate(A / 4));
        var i0 = Math.Truncate(365.25 * (Y + 4716));
        var i1 = Math.Truncate(30.6001 * (M + 1));
        return i0 + i1 + day + B - 1524.5;
    }

    static double DaysSinceSolstice(int dayOfYear, int year, double latitude)
    {
        var daysInYear = IsLeapYear(year) ? 366 : 365;
        if (latitude >= 0)
        {
            var d = dayOfYear + 10;
            return d >= daysInYear ? d - daysInYear : d;
        }
        var s = dayOfYear - (IsLeapYear(year) ? 173 : 172);
        return s < 0 ? s + daysInYear : s;
    }

    static double Seasonal(double a, double b, double c, double d, double dyy) =>
        dyy < 91 ? a + (b - a) / 91.0 * dyy
        : dyy < 137 ? b + (c - b) / 46.0 * (dyy - 91)
        : dyy < 183 ? c + (d - c) / 46.0 * (dyy - 137)
        : dyy < 229 ? d + (c - d) / 46.0 * (dyy - 183)
        : dyy < 275 ? c + (b - c) / 46.0 * (dyy - 229)
        : b + (a - b) / 91.0 * (dyy - 275);

    static double SeasonAdjustedMorningTwilight(double latitude, int dayOfYear, int year, double sunrise)
    {
        var l = Math.Abs(latitude);
        var adjustment = Seasonal(75 + 28.65 / 55.0 * l, 75 + 19.44 / 55.0 * l, 75 + 32.74 / 55.0 * l, 75 + 48.1 / 55.0 * l,
            DaysSinceSolstice(dayOfYear, year, latitude));
        return AddSeconds(sunrise, JsRound(adjustment * -60.0));
    }

    /// <summary>Shafaq "general", adhan's default.</summary>
    static double SeasonAdjustedEveningTwilight(double latitude, int dayOfYear, int year, double sunset)
    {
        var l = Math.Abs(latitude);
        var adjustment = Seasonal(75 + 25.6 / 55.0 * l, 75 + 2.05 / 55.0 * l, 75 - 9.21 / 55.0 * l, 75 + 6.14 / 55.0 * l,
            DaysSinceSolstice(dayOfYear, year, latitude));
        return AddSeconds(sunset, JsRound(adjustment * 60.0));
    }

    sealed class SolarCoordinates
    {
        public readonly double Declination, RightAscension, ApparentSiderealTime;

        public SolarCoordinates(double julianDay)
        {
            var T = (julianDay - 2451545.0) / 36525;
            var L0 = MeanSolarLongitude(T);
            var Lp = MeanLunarLongitude(T);
            var omega = AscendingLunarNodeLongitude(T);
            var lambda = Rad(ApparentSolarLongitude(T, L0));
            var theta0 = MeanSiderealTime(T);
            var dPsi = NutationInLongitude(L0, Lp, omega);
            var dEpsilon = NutationInObliquity(L0, Lp, omega);
            var epsilon0 = MeanObliquityOfTheEcliptic(T);
            var epsilonApparent = Rad(ApparentObliquityOfTheEcliptic(T, epsilon0));
            Declination = Deg(Math.Asin(Math.Sin(epsilonApparent) * Math.Sin(lambda)));
            RightAscension = Unwind(Deg(Math.Atan2(Math.Cos(epsilonApparent) * Math.Sin(lambda), Math.Cos(lambda))));
            ApparentSiderealTime = theta0 + dPsi * 3600 * Math.Cos(Rad(epsilon0 + dEpsilon)) / 3600;
        }
    }

    sealed class SolarTime
    {
        readonly double _lat, _lng, _approxTransit;
        readonly SolarCoordinates _solar, _prev, _next;
        public readonly double Transit, Sunrise, Sunset;

        public SolarTime(int year, int month, int day, double lat, double lng)
        {
            var jd = JulianDay(year, month, day);
            (_lat, _lng) = (lat, lng);
            _solar = new(jd);
            _prev = new(jd - 1);
            _next = new(jd + 1);
            var m0 = ApproximateTransit(lng, _solar.ApparentSiderealTime, _solar.RightAscension);
            const double solarAltitude = -50.0 / 60.0;
            _approxTransit = m0;
            Transit = CorrectedTransit(m0, lng, _solar.ApparentSiderealTime, _solar.RightAscension, _prev.RightAscension, _next.RightAscension);
            Sunrise = CorrectedHourAngle(m0, solarAltitude, lat, lng, false, _solar, _prev, _next);
            Sunset = CorrectedHourAngle(m0, solarAltitude, lat, lng, true, _solar, _prev, _next);
        }

        public double HourAngle(double angle, bool afterTransit) =>
            CorrectedHourAngle(_approxTransit, angle, _lat, _lng, afterTransit, _solar, _prev, _next);

        public double Afternoon(double shadowLength)
        {
            var tangent = Math.Abs(_lat - _solar.Declination);
            var inverse = shadowLength + Math.Tan(Rad(tangent));
            return HourAngle(Deg(Math.Atan(1.0 / inverse)), true);
        }
    }
}
