// Only matters for the `expo start --web` dev target — native iOS/Android
// fetch calls aren't subject to CORS at all.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
