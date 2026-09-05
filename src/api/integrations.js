import { base44 } from "./base44Client";

function unwrap(result) {
  return result?.data ?? result;
}

export const Core = {
  InvokeLLM: (params) => unwrap(base44.integrations.Core.InvokeLLM(params)),
  GenerateImage: (params) => unwrap(base44.integrations.Core.GenerateImage(params)),
  SendEmail: (params) => unwrap(base44.integrations.Core.SendEmail(params)),
  UploadFile: (params) => unwrap(base44.integrations.Core.UploadFile(params)),
  UploadPrivateFile: (params) => unwrap(base44.integrations.Core.UploadPrivateFile(params)),
  CreateFileSignedUrl: (params) => unwrap(base44.integrations.Core.CreateFileSignedUrl(params)),
  ExtractDataFromUploadedFile: (params) => unwrap(base44.integrations.Core.ExtractDataFromUploadedFile(params)),
};

export const custom = {
  call: (slug, operationId, params) => unwrap(base44.integrations.custom.call(slug, operationId, params)),
};

export const integrations = {
  Core,
  custom,
};

export { unwrap };
