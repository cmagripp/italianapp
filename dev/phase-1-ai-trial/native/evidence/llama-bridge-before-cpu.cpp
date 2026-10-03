#include "llama-bridge.h"
#include "llama.h"
#include <string>
#include <vector>
#include <cstring>
#include <cstdlib>
#include <algorithm>
#include <mach/mach.h>

// Investigation-only bounded native engine. The host scopes cancellation and
// validates source/Italian separately; grammar is not a semantic quality gate.
struct ParolaModel { llama_model *model; llama_context *context; };
static void failure(char **error,const char *message){if(error)*error=strdup(message);}
extern "C" void *parola_model_create(const char *path,int gpu_layers,char **error){
    llama_backend_init();auto model_params=llama_model_default_params();model_params.n_gpu_layers=gpu_layers;
    auto *model=llama_model_load_from_file(path,model_params);if(!model){failure(error,"The pinned local model could not load.");return nullptr;}
    auto params=llama_context_default_params();params.n_ctx=4096;params.n_batch=256;params.n_ubatch=256;params.n_threads=8;params.n_threads_batch=8;params.flash_attn_type=LLAMA_FLASH_ATTN_TYPE_AUTO;
    auto *context=llama_init_from_model(model,params);if(!context){llama_model_free(model);failure(error,"The native model context could not start.");return nullptr;}
    return new ParolaModel{model,context};
}
extern "C" char *parola_generate(void *handle,const char *instructions,const char *prompt,const char *grammar,int max_tokens,int *input_tokens,int *output_tokens,char **error){
    if(!handle||max_tokens<1||max_tokens>512){failure(error,"Invalid native inference request.");return nullptr;}
    auto *engine=static_cast<ParolaModel*>(handle);const auto *vocab=llama_model_get_vocab(engine->model);
    // Exact Qwen ChatML with the official non-thinking assistant prefill. The
    // model card recommends .7/.8/20/0 and presence1.5 for non-thinking mode.
    std::string text="<|im_start|>system\n"+std::string(instructions)+"\n/no_think<|im_end|>\n<|im_start|>user\n"+prompt+"<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n";
    int count=-llama_tokenize(vocab,text.data(),int(text.size()),nullptr,0,true,true);if(count<=0||count+max_tokens>4096){failure(error,"Native prompt exceeds the fixed context budget.");return nullptr;}
    std::vector<llama_token> tokens(count);count=llama_tokenize(vocab,text.data(),int(text.size()),tokens.data(),count,true,true);if(count<0){failure(error,"Native tokenization failed.");return nullptr;}
    if(input_tokens)*input_tokens=count;if(output_tokens)*output_tokens=0;llama_memory_clear(llama_get_memory(engine->context),true);
    for(int offset=0;offset<count;offset+=256){auto batch=llama_batch_get_one(tokens.data()+offset,std::min(256,count-offset));if(llama_decode(engine->context,batch)){failure(error,"Native prompt evaluation failed.");return nullptr;}}
    auto *sampler=llama_sampler_chain_init(llama_sampler_chain_default_params());
    if(grammar&&*grammar){auto *constraint=llama_sampler_init_grammar(vocab,grammar,"root");if(!constraint){llama_sampler_free(sampler);failure(error,"Native response grammar is invalid.");return nullptr;}llama_sampler_chain_add(sampler,constraint);}
    llama_sampler_chain_add(sampler,llama_sampler_init_penalties(llama_vocab_n_tokens(vocab),64,1.0f,0.0f,1.5f));llama_sampler_chain_add(sampler,llama_sampler_init_top_k(20));llama_sampler_chain_add(sampler,llama_sampler_init_top_p(.8f,1));llama_sampler_chain_add(sampler,llama_sampler_init_min_p(0,1));llama_sampler_chain_add(sampler,llama_sampler_init_temp(.7f));llama_sampler_chain_add(sampler,llama_sampler_init_dist(42));
    std::string output;
    for(int index=0;index<max_tokens;index++){
        auto token=llama_sampler_sample(sampler,engine->context,-1);if(llama_vocab_is_eog(vocab,token))break;
        char piece[256];int size=llama_token_to_piece(vocab,token,piece,sizeof(piece),0,true);
        if(size<0){std::vector<char> large(-size);size=llama_token_to_piece(vocab,token,large.data(),int(large.size()),0,true);if(size>0)output.append(large.data(),size);}else output.append(piece,size);
        if(output_tokens)(*output_tokens)++;auto batch=llama_batch_get_one(&token,1);if(llama_decode(engine->context,batch)){llama_sampler_free(sampler);failure(error,"Native response evaluation failed.");return nullptr;}
    }
    llama_sampler_free(sampler);return strdup(output.c_str());
}
extern "C" unsigned long long parola_model_bytes(void *handle){return handle?llama_model_size(static_cast<ParolaModel*>(handle)->model):0;}
extern "C" void parola_model_destroy(void *handle){if(!handle)return;auto *model=static_cast<ParolaModel*>(handle);llama_free(model->context);llama_model_free(model->model);delete model;}
extern "C" unsigned long long parola_memory_footprint(){task_vm_info_data_t info{};mach_msg_type_number_t count=TASK_VM_INFO_COUNT;return task_info(mach_task_self(),TASK_VM_INFO,reinterpret_cast<task_info_t>(&info),&count)==KERN_SUCCESS?info.phys_footprint:0;}
