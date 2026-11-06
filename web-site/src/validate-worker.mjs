import {validateFile} from './validate.mjs';
self.onmessage=async({data})=>{try{const result=await validateFile(data);self.postMessage({result},[result.bytes]);}catch(error){self.postMessage({error:error.message||'The file could not be validated.'});}};
