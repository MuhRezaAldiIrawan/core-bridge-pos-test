/**
 * Message interface for RabbitMQ queue messages
 */
export interface QueueMessage<T = unknown> {
  id: string;
  correlation_id: string;
  timestamp: Date;
  data: T;
}

/**
 * Access Request payload from HST to Wristpay
 */
export interface AccessRequestPayload {
  transaction_id: string;
  member_uid: string;
  member_name: string;
  image_url: string;
  phone_number?: string;
  email?: string;
  venue_id: string;
  site_code: string;
  access_level_uid: string;
  product_id: number;
  product_name: string;
  product_type: string;
  processor_code: string;
  checkin_timestamp: string;
}

/**
 * Access Response payload from Wristpay to Core Bridge
 */
export interface AccessResponsePayload {
  transaction_id: string;
  status: 'Success' | 'Failed';
  processed_at: string;
  access_level_uid?: string;
  code: number;
  processed_by?: string;
  error_code?: string;
  error_message?: string;
}

/**
 * Checkimage Request payload
 */
export interface CheckimageRequestPayload {
  transaction_id: string;
  member_uid: string;
  member_name: string;
  image_url: string;
  processor_code: string;
}

/**
 * RabbitMQ connection configuration
 */
export interface RabbitMQConfig {
  url: string;
  exchangeAccessRequest: string;
  exchangeAccessResponse: string;
  exchangeWebhook: string;
  dlxAccessRequest: string;
  dlxAccessResponse: string;
  dlxWebhook: string;
}
