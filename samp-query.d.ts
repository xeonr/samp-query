declare module 'samp-query' {
    namespace Query {
        export interface QueryOptions {
            host: string,
            port?: number,
            timeout?: number,
        }
        export interface QueryPlayer {
            id: number,
            name: string,
            score:number,
            ping:number,
        }
        export interface QueryRules {
            [ key: string ]: string | boolean | number,
        }
        export interface QueryResponse {
            address:string,
            hostname: string,
            gamemode: string,
            language: string,
            passworded: boolean,
            maxplayers: number,
            online: number,
            rules: QueryRules,
            players: QueryPlayer[],
        }
    }
    const Query: ( options: Query.QueryOptions ) => Promise<Query.QueryResponse>;
    export = Query;
}