let Responder = {
    sendResponse: (response, statusCode, status, data, message) => {
        
        let json = {
            success: status === 'true' ? true : false,
            data: data,
            message: message
        };

        if (data && data.list) {
            json.data = data.list;
            json.totalRecords = data.totalRecord;
        }

        response.status(statusCode).json(json);
    },
    sendErrorResponse: (response, message) => {
        response.status(422).json({
            error: message
        });
    }
};
module.exports = Responder;
