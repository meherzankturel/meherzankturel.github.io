import { sendPushNotification } from '../utils/notifications';

// OpenWeatherMap API - Free tier (1000 calls/day)
const OPENWEATHER_API_KEY = 'b639ba18a0151154c4d0e42844f38f53';
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

export interface WeatherData {
    temp: number;
    feelsLike: number;
    description: string;
    icon: string;
    humidity: number;
    windSpeed: number;
    condition: WeatherCondition;
    isSevere: boolean;
    alerts?: WeatherAlert[];
}

export interface WeatherAlert {
    event: string;
    description: string;
    start: Date;
    end: Date;
    severity: 'minor' | 'moderate' | 'severe' | 'extreme';
}

export type WeatherCondition =
    | 'clear'
    | 'clouds'
    | 'rain'
    | 'drizzle'
    | 'thunderstorm'
    | 'snow'
    | 'mist'
    | 'fog'
    | 'haze'
    | 'dust'
    | 'tornado'
    | 'unknown';

// Severe weather conditions that should trigger alerts
const SEVERE_CONDITIONS: WeatherCondition[] = ['thunderstorm', 'tornado', 'snow'];
const SEVERE_WEATHER_IDS = [200, 201, 202, 210, 211, 212, 221, 230, 231, 232, // Thunderstorm
    511, // Freezing rain
    602, 621, 622, // Heavy snow
    781]; // Tornado

export class WeatherService {
    private static apiKey = OPENWEATHER_API_KEY;
    private static cache: Map<string, { data: WeatherData; timestamp: number }> = new Map();
    private static CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

    /**
     * Set the API key (call this on app init)
     */
    static setApiKey(key: string) {
        this.apiKey = key;
    }

    /**
     * Get weather by coordinates
     */
    static async getWeatherByCoords(lat: number, lon: number): Promise<WeatherData | null> {
        const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;

        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.data;
        }

        try {
            const response = await fetch(
                `${OPENWEATHER_BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`
            );

            if (!response.ok) {
                console.error('Weather API error:', response.status);
                return null;
            }

            const data = await response.json();
            const weather = this.parseWeatherData(data);

            // Cache the result
            this.cache.set(cacheKey, { data: weather, timestamp: Date.now() });

            return weather;
        } catch (error) {
            console.error('Error fetching weather:', error);
            return null;
        }
    }

    /**
     * Get weather by city name
     */
    static async getWeatherByCity(city: string): Promise<WeatherData | null> {
        const cacheKey = city.toLowerCase();

        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.data;
        }

        try {
            const response = await fetch(
                `${OPENWEATHER_BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=metric`
            );

            if (!response.ok) {
                console.error('Weather API error:', response.status);
                return null;
            }

            const data = await response.json();
            const weather = this.parseWeatherData(data);

            // Cache the result
            this.cache.set(cacheKey, { data: weather, timestamp: Date.now() });

            return weather;
        } catch (error) {
            console.error('Error fetching weather:', error);
            return null;
        }
    }

    /**
     * Parse OpenWeatherMap response to our format
     */
    private static parseWeatherData(data: any): WeatherData {
        const weatherId = data.weather?.[0]?.id || 0;
        const condition = this.getConditionFromId(weatherId);
        const isSevere = SEVERE_WEATHER_IDS.includes(weatherId) || SEVERE_CONDITIONS.includes(condition);

        return {
            temp: Math.round(data.main?.temp || 0),
            feelsLike: Math.round(data.main?.feels_like || 0),
            description: data.weather?.[0]?.description || 'Unknown',
            icon: data.weather?.[0]?.icon || '01d',
            humidity: data.main?.humidity || 0,
            windSpeed: Math.round(data.wind?.speed || 0),
            condition,
            isSevere,
        };
    }

    /**
     * Map OpenWeatherMap condition ID to our condition type
     */
    private static getConditionFromId(id: number): WeatherCondition {
        if (id >= 200 && id < 300) return 'thunderstorm';
        if (id >= 300 && id < 400) return 'drizzle';
        if (id >= 500 && id < 600) return 'rain';
        if (id >= 600 && id < 700) return 'snow';
        if (id === 701) return 'mist';
        if (id === 711) return 'haze';
        if (id === 721) return 'haze';
        if (id === 741) return 'fog';
        if (id === 751 || id === 761) return 'dust';
        if (id === 781) return 'tornado';
        if (id >= 700 && id < 800) return 'mist';
        if (id === 800) return 'clear';
        if (id > 800) return 'clouds';
        return 'unknown';
    }

    /**
     * Get weather icon name for Ionicons
     */
    static getWeatherIcon(condition: WeatherCondition, isDay: boolean = true): string {
        switch (condition) {
            case 'clear':
                return isDay ? 'sunny' : 'moon';
            case 'clouds':
                return isDay ? 'partly-sunny' : 'cloudy-night';
            case 'rain':
            case 'drizzle':
                return 'rainy';
            case 'thunderstorm':
                return 'thunderstorm';
            case 'snow':
                return 'snow';
            case 'mist':
            case 'fog':
            case 'haze':
                return 'cloudy';
            case 'dust':
                return 'cloudy';
            case 'tornado':
                return 'warning';
            default:
                return 'cloudy';
        }
    }

    /**
     * Get weather color based on condition
     */
    static getWeatherColor(condition: WeatherCondition): string {
        switch (condition) {
            case 'clear':
                return '#F59E0B'; // Sunny yellow
            case 'clouds':
                return '#9CA3AF'; // Gray
            case 'rain':
            case 'drizzle':
                return '#60A5FA'; // Blue
            case 'thunderstorm':
                return '#8B5CF6'; // Purple
            case 'snow':
                return '#93C5FD'; // Light blue
            case 'tornado':
                return '#EF4444'; // Red
            default:
                return '#9CA3AF'; // Gray
        }
    }

    /**
     * Send severe weather notification to partner
     */
    static async notifyPartnerOfSevereWeather(
        partnerPushToken: string,
        partnerCity: string,
        weather: WeatherData,
        yourName: string
    ): Promise<void> {
        if (!weather.isSevere || !partnerPushToken) return;

        try {
            await sendPushNotification(
                partnerPushToken,
                `⚠️ Weather Alert for ${partnerCity}`,
                `${yourName}'s city is experiencing ${weather.description}. Stay safe!`,
                { type: 'weather_alert', condition: weather.condition }
            );
        } catch (error) {
            console.error('Error sending weather notification:', error);
        }
    }

    /**
     * Format temperature for display (now uses Celsius by default)
     */
    static formatTemp(temp: number, unit: 'F' | 'C' = 'C'): string {
        if (unit === 'F') {
            const fahrenheit = Math.round((temp * 9 / 5) + 32);
            return `${fahrenheit}°F`;
        }
        return `${Math.round(temp)}°C`;
    }

    /**
     * Get a short weather description
     */
    static getShortDescription(weather: WeatherData): string {
        const temp = this.formatTemp(weather.temp);
        const desc = weather.description.charAt(0).toUpperCase() + weather.description.slice(1);
        return `${temp} • ${desc}`;
    }
}
