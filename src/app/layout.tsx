import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'CORTEX — Voice becomes behavior',description:'Voice-driven, memory-enabled robot operating system. Gradium, Pipecat and SambaNova turn speech into safe physical behavior on Unitree G1.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
