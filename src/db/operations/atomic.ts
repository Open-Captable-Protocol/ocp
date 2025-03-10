// Store a global mongo session to allows us to bundle CRUD operations into one transaction

import { Connection, QueryOptions, Model, ClientSession, FilterQuery, UpdateQuery, ProjectionType } from "mongoose";
import { connectDB } from "../config/mongoose";

type TQueryOptions<T = any> = QueryOptions<T> | undefined;
type TSession = ClientSession | null;

let _globalSession: TSession = null;

export const setGlobalSession = (session: ClientSession): void => {
    if (_globalSession !== null) {
        throw new Error(
            `globalSession is already set! ${_globalSession}. 
            Nested transactions are not supported`
        );
    }
    _globalSession = session;
};

export const clearGlobalSession = (): void => {
    _globalSession = null;
};

const isReplSet = (): boolean => {
    if (process.env.DATABASE_REPLSET === "1") {
        return true;
    }
    return false;
};

export const withGlobalTransaction = async (func: () => Promise<void>, useConn?: Connection): Promise<void> => {
    if (!isReplSet()) {
        // Transactions in mongo only work when running with --replSet
        //  https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/
        return await func();
    }

    // Wrap a user defined `func` in a global transaction
    const dbConn = useConn || (await connectDB());
    await dbConn.transaction(async (session) => {
        setGlobalSession(session);
        try {
            return await func();
        } finally {
            clearGlobalSession();
        }
    });
};

const includeSession = <T>(options?: TQueryOptions<T>): TQueryOptions<T> => {
    let useOptions = options || {};
    if (_globalSession !== null) {
        if (useOptions.session) {
            throw new Error(`options.session is already set!: ${useOptions}`);
        }
        useOptions.session = _globalSession;
    }
    return useOptions;
};

/* 
Wrapped mongoose db calls. All mongo interaction should go through a function below
*/

// CREATE

export const create = <T>(model: Model<T>, options?: TQueryOptions<T>): Promise<T> => {
    return (model as Model<T>).create(includeSession(options));
};

// UPDATE

export const findByIdAndUpdate = <T>(model: Model<T>, id: string, updatedData: UpdateQuery<T>, options?: TQueryOptions<T>): Promise<T | null> => {
    return model.findByIdAndUpdate(id, updatedData, includeSession(options));
};

export const findBySecurityIdAndUpdate = <T>(
    model: Model<T>,
    securityId: string,
    updatedData: UpdateQuery<T>,
    options?: TQueryOptions<T>
): Promise<T | null> => {
    return model.findOneAndUpdate({ security_id: securityId } as FilterQuery<T>, updatedData, includeSession(options));
};

// DELETE

export const findByIdAndDelete = <T>(model: Model<T>, id: string, options?: TQueryOptions<T>): Promise<T | null> => {
    return model.findByIdAndDelete(id, includeSession(options));
};

// QUERY

export const findById = <T>(model: Model<T>, id: string, projection?: ProjectionType<T>, options?: TQueryOptions<T>): Promise<T | null> => {
    return model.findById(id, projection, includeSession(options));
};

export const findOne = <T>(
    model: Model<T>,
    filter: FilterQuery<T>,
    projection?: ProjectionType<T>,
    options?: TQueryOptions<T>
): Promise<T | null> => {
    return model.findOne(filter, projection, includeSession(options));
};

export const find = <T>(model: Model<T>, filter: FilterQuery<T>, projection?: ProjectionType<T>, options?: TQueryOptions<T>): Promise<T[]> => {
    return model.find(filter, projection, includeSession(options));
};

export const countDocuments = <T>(model: Model<T>, filter?: FilterQuery<T>, options?: TQueryOptions<T>): Promise<number> => {
    return model.countDocuments(filter || {}, includeSession(options));
};
