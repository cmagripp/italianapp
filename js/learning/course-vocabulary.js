// Registration keeps course navigation independent of lesson authoring code.
let resolver=null;
export const registerCourseVocabulary=fn=>{resolver=fn;};
export function attachCourseVocabulary(lesson,dictionary){if(!resolver)return false;resolver(lesson,dictionary);return true;}
