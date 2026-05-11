declare global {
    var User: {
        /**
         * Retrieves the value of a user variable by its key name
         * @param key - The name of the variable to retrieve
         * @returns The value stored for the given key, or undefined if not found
         */
        get(key: string): any;

        /**
         * Sets a value for a user variable identified by key name
         * @param key - The name of the variable to set
         * @param value - The value to store for the given key
         */
        set(key: string, value: any): void;
    };
}

export {};
