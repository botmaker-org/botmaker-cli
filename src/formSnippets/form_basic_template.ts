// this code runs in a node 20.0.0 environment

// *** VARIABLES IN SCOPE
// action: 'data_exchange' | 'INIT' | 'BACK'.
//   - 'data_exchange': this is the most common case, received when a screen's Footer button has an "on-click-action" with "name" === "data_exchange".
//   - 'INIT': when the message that opens the form is marked with "data_exchange"
//   - 'BACK': when a screen has "refresh_on_back" set to true. In the code, you must provide the data for the previous screen (with form.data = { ... }).
// screen: string. When action is 'data_exchange' or 'BACK', the name of the screen the user is leaving.
// data: values sent from the form json in "payload", usually the user input.
// form: the object you use to respond to whatsapp.

// *** form RESPONSE
// form.nextScreen: string (property). Use it to define which screen the form should go to. If you need to finish the form, either set it to 'SUCCESS' or ignore it. (You don't have to set it when `action === 'BACK'`)
// form.data: { [key:string]: any } (property). Use it to pass data to the next screen or to send data back to Botmaker variables (when the screen is the last). When used together with `form.nextScreen`, `form.data` must match the structure of the next screen input "data" (defined in the form json).
// form.send(). You must ALWAYS call `form.send()` to finish the endpoint execution, in order to resume the form in Webchat. You must call `form.send()` AFTER setting the previous properties (nextScreen and/or). It's like the `return` of a function, only here it means you're done. (if you forget this, the form won't continue).

// *** UTILITIES
// bmconsole.log(...args), bmconsole.warn(...args), bmconsole.error(...args). Use these to view logs in Botmaker Code Actions screen.
// fetch(NodeJS.fetch.RequestInfo, RequestInit?): Promise<Response>. regular javascript fetch api.
// saveScreenData(): Promise. Saves current screen data in order to use in a latter screen. (Expires in 3 days).
// loadPrevScreenData(): Promise<{ [key:string]: any }>. Loads previously saved data with `saveScreenData()`.

// *** botmakerAPI
// botmakerAPI.ACCESS_TOKEN: string (property). Set the auth token for all botmakerAPI calls (botmakerAPI.ACCESS_TOKEN = 'your token here';).
// botmakerAPI.getChat(): Promise<Chat>. Calls https://api.botmaker.com/v2.0/chats/{chatReference}.
// botmakerAPI.updateChat({variables, tags, firstName, lastName, email}): Promise. Calls https://api.botmaker.com/v2.0/chats/{chatReference}.
// botmakerAPI.getProducts(catalogId: string, skus: string[]): Promise<Product[]>. Calls https://api.botmaker.com/v2.0/ecommerce/catalogs/{catalogId}/products.

// *** MODULES IN SCOPE
// fs, crypto, jsonwebtoken as jwt, moment, momentTimezone, fast-csv as csv, xml2js, turf

// *** OTHER UTILITIES
// entityLoader(): Promise. Loads entities uploaded to botmaker.
// fetchSecured(uri, options): Promise.

// declaring boolean vars for screens simplifies conditionals
const FIRST_SCREEN = screen === 'FIRST_SCREEN';
const SECOND_SCREEN = screen === 'SECOND_SCREEN';
const THIRD_SCREEN = screen === 'THIRD_SCREEN';

if (FIRST_SCREEN) {
    // example: determine nextScreen from an api call
    fetch('https://yourapi.example/api')
        .then(response => response.json())
        .then(({answer}) => {
            form.nextScreen = answer === 'yes' ? 'SECOND_SCREEN' : 'THIRD_SCREEN';
            // Note: form.data must match the `data` definition in the form json
            form.data = {
                saidYes: answer === 'yes',
                fieldRequiredInNextScreen: data.someField
            };
        })
        .catch(err => bmconsole.error('You will find this log on Code Action screen/Logs tab', err.message))
        .finally(form.send); // remember to always call form.send()
}
else if (SECOND_SCREEN || THIRD_SCREEN) {
    // Example: save inbetween data with saveScreenData(), to later retrieve it
    saveScreenData()
        .then(ignored => form.nextScreen = 'LAST_SCREEN')
        .catch(err => bmconsole.error('You will find this log on Code Action screen/Logs tab', err.message))
        .finally(form.send);
}
else { // LAST_SCREEN
    // Example: respond to form, using data from previous 
    loadPrevScreenData()
        .then(prevFormData => {
            // formOutput1 and formOutput2 should be binded to botmaker variables in the forms screen
            form.data = {
                formOutput1: prevFormData.field,
                formOutput2: data.field
            };
        })
        .finally(form.send);
}