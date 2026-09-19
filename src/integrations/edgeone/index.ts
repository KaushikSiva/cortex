export interface ExecutionAdapter{executeCommand(command:'healthcheck'|'read_controller_state'):Promise<unknown>;readFile(name:'controller-state'):Promise<string>;runHealthCheck():Promise<unknown>}
export class LocalExecutionAdapter implements ExecutionAdapter{
 constructor(private robotUrl=process.env.MUJOCO_API_URL??'http://127.0.0.1:8002'){}
 async executeCommand(command:'healthcheck'|'read_controller_state'){if(!['healthcheck','read_controller_state'].includes(command))throw new Error('Command not allowlisted');const r=await fetch(this.robotUrl+'/state',{signal:AbortSignal.timeout(1500)});if(!r.ok)throw new Error('Controller unavailable');return r.json();}
 async readFile(name:'controller-state'){if(name!=='controller-state')throw new Error('File not allowlisted');return JSON.stringify(await this.executeCommand('read_controller_state'));}
 async runHealthCheck(){return this.executeCommand('healthcheck');}
}
// This is OUR deployed EdgeOne route, not a claimed vendor sandbox API.
export class EdgeOneExecutionAdapter implements ExecutionAdapter{
 constructor(private url:string,private token:string){}
 async executeCommand(command:'healthcheck'|'read_controller_state'){if(!['healthcheck','read_controller_state'].includes(command))throw new Error('Command not allowlisted');const r=await fetch(this.url+'/api/execution',{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify({command}),signal:AbortSignal.timeout(2000)});if(!r.ok)throw new Error(`EdgeOne execution HTTP ${r.status}`);return r.json();}
 async readFile(name:'controller-state'){if(name!=='controller-state')throw new Error('File not allowlisted');return JSON.stringify(await this.executeCommand('read_controller_state'));}
 async runHealthCheck(){return this.executeCommand('healthcheck');}
}
