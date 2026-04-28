declare module 'jsforce' {
  export class Connection {
    constructor(options?: Record<string, unknown>)
    login(username: string, password: string): Promise<unknown>
    sobject(name: string): unknown
  }

  const jsforce: {
    Connection: typeof Connection
  }

  export default jsforce
}
