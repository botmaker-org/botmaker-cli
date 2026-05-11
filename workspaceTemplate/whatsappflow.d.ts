import momentTimezone from 'moment-timezone';
import crypto from 'crypto';

type WhatsappFlowAction = 'data_exchange' | 'INIT' | 'BACK';

interface BmFlow {
  /**
   * Name of the next screen to navigate to. Set to 'SUCCESS' or leave undefined to finish the flow.
   */
  nextScreen?: string;
  /**
   * Data passed to the next screen, or back to Botmaker variables when on the last screen.
   * When used with `nextScreen`, must match the structure of the next screen's "data" input.
   */
  data?: { [key: string]: any };
  /**
   * Finish endpoint execution and resume the flow on WhatsApp. Always call this last.
   */
  send: () => void;
}

interface BmFlowConsole {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

interface BmChat {
  chatPlatformId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  variables?: { [key: string]: any };
  tags?: string[];
  [key: string]: any;
}

interface BmChatUpdate {
  variables?: { [key: string]: any };
  tags?: string[];
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface BmProduct {
  id?: string;
  name?: string;
  retailerId?: string;
  availability?: string;
  price?: string;
  currency?: string;
  [key: string]: any;
}

interface BmBotmakerAPI {
  /**
   * Auth token used by all botmakerAPI calls. Set this before calling any method.
   */
  ACCESS_TOKEN: string;
  /**
   * GET https://api.botmaker.com/v2.0/chats/{chatReference}
   */
  getChat: () => Promise<BmChat>;
  /**
   * PUT https://api.botmaker.com/v2.0/chats/{chatReference}
   */
  updateChat: (update: BmChatUpdate) => Promise<void>;
  /**
   * GET https://api.botmaker.com/v2.0/ecommerce/catalogs/{catalogId}/products
   */
  getProducts: (catalogId: string, skus: string[]) => Promise<BmProduct[]>;
}

declare global {
  /**
   * - 'data_exchange': received when a screen's Footer button has on-click-action name === 'data_exchange'.
   * - 'INIT': sent when the message that opens the flow is marked with 'data_exchange'.
   * - 'BACK': sent when a screen has refresh_on_back === true. You must provide data for the previous screen.
   */
  const action: WhatsappFlowAction;
  /**
   * Name of the screen the user is leaving. Set when action is 'data_exchange' or 'BACK'.
   */
  const screen: string;
  /**
   * Values sent from the flow JSON in "payload", usually the user input.
   */
  const data: { [key: string]: any };
  /**
   * Response object. Set `nextScreen` and/or `data`, then call `send()` to resume the flow.
   */
  const flow: BmFlow;

  const bmconsole: BmFlowConsole;
  const botmakerAPI: BmBotmakerAPI;

  /**
   * Saves current screen data for use in a later screen. Expires in 3 days.
   */
  function saveScreenData(): Promise<void>;
  /**
   * Loads data previously saved with saveScreenData().
   */
  function loadPrevScreenData(): Promise<{ [key: string]: any }>;

  /**
   * Loads entities uploaded to Botmaker.
   */
  function entityLoader(): Promise<any>;
  /**
   * Authenticated fetch via Botmaker.
   */
  function fetchSecured(uri: string, options?: RequestInit): Promise<Response>;

  const momentTimezone: typeof momentTimezone;
  const crypto: typeof crypto;
}

export {};
