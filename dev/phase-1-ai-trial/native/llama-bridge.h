#ifdef __cplusplus
extern "C" {
#endif
void *parola_model_create(const char *path,int gpu_layers,char **error);
char *parola_generate(void *handle,const char *instructions,const char *prompt,const char *grammar,int max_tokens,int *input_tokens,int *output_tokens,char **error);
unsigned long long parola_model_bytes(void *handle);
void parola_model_destroy(void *handle);
unsigned long long parola_memory_footprint(void);
#ifdef __cplusplus
}
#endif
