import type {ToolCall} from '../types';
/** Explicit commands only: questions about movement never authorize an action. */
export function directMotion(text:string):ToolCall|null{
 let command=text.trim().replace(/[.!?]+$/,'').replace(/^(?:(?:okay|ok|hey|cortex)[, ]+)*(?:(?:can|could|would) you\s+)?(?:please\s+)?/i,'').replace(/,?\s+please$/i,'');
 // Gradium can return number words (or “to meters” for “two meters”).
 // Normalize only a quantity immediately before a motion unit; the entire
 // utterance must still match an explicit bounded movement instruction below.
 const quantities:Record<string,string>={'a':'1','one':'1','two':'2','to':'2','three':'3','half':'0.5','half a':'0.5','ninety':'90','forty five':'45','forty-five':'45','one hundred eighty':'180','one hundred and eighty':'180'};
 command=command.replace(/\b(one hundred and eighty|one hundred eighty|forty five|forty-five|ninety|half a|half|one|two|three|to|a)(?=\s+(?:meters?|metres?|degrees?)\b)/gi,word=>quantities[word.toLowerCase()]);
 if(/^come(?:\s+over)?\s+here$/i.test(command))return {name:'walk_to',arguments:{target:'PERSON'}};
 if(/^(?:move|go|walk|head|return)(?:\s+back)?(?:\s+to)?\s+home$/i.test(command))return {name:'return_home',arguments:{}};
 const target=command.match(/^(?:move|go|walk|head)(?:\s+to|\s+towards?)\s+(?:the\s+)?(bench|planter|door|person)$/i);
 if(target)return {name:'walk_to',arguments:{target:target[1].toUpperCase()}};
 const direction=command.match(/^(?:move|go|walk|step)\s+(forward|forwards|front|back|backward|backwards|left|right)(?:\s+(\d+(?:\.\d+)?)\s*(?:meters?|metres?|m))?$/i);
 if(direction)return {name:'walk',arguments:{direction:/^for|front/i.test(direction[1])?'front':/^back/i.test(direction[1])?'back':direction[1].toLowerCase(),meters:direction[2]?Number(direction[2]):1}};
 const turn=command.match(/^turn\s+(left|right|around|back)(?:\s+(\d+(?:\.\d+)?)(?:\s+degrees?)?)?$/i);
 if(turn)return {name:'turn',arguments:{angleDegrees:(turn[2]?Number(turn[2]):/back|around/i.test(turn[1])?180:90)*(turn[1].toLowerCase()==='right'?-1:1)}};
 return null;
}
export const towardHouses=(text:string)=>/^(?:(?:okay|ok|hey|cortex)[, ]+)*(?:(?:can|could|would) you\s+)?(?:please\s+)?(?:move|go|walk|head)\s+towards?\s+(?:the\s+)?(?:houses|painted ladies)(?:,?\s+please)?[.!?]*$/i.test(text.trim());
