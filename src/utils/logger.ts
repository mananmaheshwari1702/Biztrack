/**
 * Application Logger Utility
 * Centralizes logging to allow for easy environment configuration and future expansion (e.g., to external monitoring services).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
    private isDev = import.meta.env.MODE === 'development';

    private logToConsole(level: LogLevel, ...args: any[]) {
        // In production, we might want to suppress debug/info logs or send errors to a service
        if (!this.isDev && (level === 'debug' || level === 'info')) {
            return;
        }

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        switch (level) {
            case 'debug':
                console.debug(prefix, ...args);
                break;
            case 'info':
                console.info(prefix, ...args);
                break;
            case 'warn':
                console.warn(prefix, ...args);
                break;
            case 'error':
                console.error(prefix, ...args);
                break;
        }
    }

    debug(...args: any[]) {
        this.logToConsole('debug', ...args);
    }

    info(...args: any[]) {
        this.logToConsole('info', ...args);
    }

    warn(...args: any[]) {
        this.logToConsole('warn', ...args);
    }

    error(...args: any[]) {
        this.logToConsole('error', ...args);
    }
}

export const logger = new Logger();
